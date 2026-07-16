import type { ResolvedType } from "../xsd/xsd-resolver";

/**
 * Sorts resolved types so every dependency is declared before its dependents.
 *
 * Generated classes reference each other at module-evaluation time through
 * `extends <Base>` clauses and decorator options (`type: Foo`). Since xml-poto
 * uses standard TC39 decorators, both are evaluated while later classes are
 * still in their temporal dead zone — so declaration order must satisfy the
 * dependency graph.
 *
 * Two edge kinds are distinguished:
 * - **hard** edges (`extends` via `baseTypeName`): must be satisfied by
 *   ordering — a thunk cannot defer an extends clause. A cycle of hard edges
 *   is invalid XSD and raises an error.
 * - **soft** edges (decorator `type:` refs via `complexTypeName` /
 *   `arrayItemType`): satisfied by ordering where possible. Edges inside a
 *   strongly connected component (including self-references) cannot be
 *   linearized and are reported in `lazyRefs`, so the generator emits them as
 *   hoist-safe `() => Foo` thunks instead of direct identifiers.
 *
 * Ordering is stable and deterministic: input already in a valid dependency
 * order is returned unchanged, and independent types keep their original
 * (XSD document) order. This is implemented as Tarjan SCC condensation
 * followed by Kahn's algorithm that always emits the ready component whose
 * smallest original index is lowest.
 */
export interface TypeSortResult {
	/** Types in dependency-first order (stable among independent types) */
	sorted: ResolvedType[];
	/** className -> referenced classNames that must be emitted as `() => X` thunks */
	lazyRefs: Map<string, Set<string>>;
	/**
	 * Groups of classes (2+) that must be emitted into the same module in
	 * per-type mode: classes linked by an `extends` edge inside a dependency
	 * cycle. An extends clause evaluates eagerly during module evaluation, so
	 * if base and derived sit in different modules of an import cycle, some
	 * entry order always hits the base's temporal dead zone. (Cycles made of
	 * decorator references only are safe across modules — those are thunks.)
	 * Each group lists classNames in emit order (base before derived).
	 */
	sameModuleClusters: string[][];
}

export function sortTypesByDependency(types: ResolvedType[]): TypeSortResult {
	const { hardEdges, softEdges } = buildEdges(types);
	const n = types.length;

	const sccOf = computeSccs(n, (v) => [...hardEdges[v], ...softEdges[v]]);
	const sccCount = Math.max(-1, ...sccOf) + 1;
	const sccMembers: number[][] = Array.from({ length: sccCount }, () => []);
	for (let v = 0; v < n; v++) {
		sccMembers[sccOf[v]].push(v);
	}
	for (const members of sccMembers) {
		members.sort((a, b) => a - b);
	}

	const graph: DependencyGraph = { types, hardEdges, softEdges, sccOf, sccMembers };
	const lazyRefs = collectLazyRefs(graph);
	const sorted = orderCondensation(graph);
	const sameModuleClusters = collectSameModuleClusters(graph, sorted);

	return { sorted, lazyRefs, sameModuleClusters };
}

interface DependencyGraph {
	types: ResolvedType[];
	hardEdges: number[][];
	softEdges: number[][];
	sccOf: number[];
	sccMembers: number[][];
}

/**
 * Build the dependency edges between types, by node index. Hard edges are
 * extends relations (`baseTypeName`), soft edges are decorator `type:`
 * references (`complexTypeName` / `arrayItemType`). References to
 * built-in/external names are not part of the graph.
 */
function buildEdges(types: ResolvedType[]): { hardEdges: number[][]; softEdges: number[][] } {
	const n = types.length;
	const indexByName = new Map<string, number>();
	for (let i = 0; i < n; i++) {
		// Resolver guarantees unique class names; keep the first occurrence defensively.
		if (!indexByName.has(types[i].className)) {
			indexByName.set(types[i].className, i);
		}
	}

	const hardEdges: number[][] = Array.from({ length: n }, () => []);
	const softEdges: number[][] = Array.from({ length: n }, () => []);

	for (let i = 0; i < n; i++) {
		const type = types[i];
		if (type.baseTypeName !== undefined) {
			const target = indexByName.get(type.baseTypeName);
			if (target !== undefined) {
				hardEdges[i].push(target);
			}
		}

		const softTargets = new Set<number>();
		for (const prop of type.properties) {
			for (const ref of [prop.complexTypeName, prop.arrayItemType]) {
				if (ref === undefined) continue;
				const target = indexByName.get(ref);
				if (target !== undefined) {
					softTargets.add(target);
				}
			}
		}
		softEdges[i] = [...softTargets].sort((a, b) => a - b);
	}

	return { hardEdges, softEdges };
}

/**
 * Classify intra-SCC soft edges as lazy refs. Intra-SCC hard edges are fine
 * as long as the hard edges alone are acyclic — orderSccMembers verifies that.
 * A self-extends is always fatal.
 */
function collectLazyRefs(graph: DependencyGraph): Map<string, Set<string>> {
	const { types, hardEdges, softEdges, sccOf, sccMembers } = graph;
	const lazyRefs = new Map<string, Set<string>>();
	for (let v = 0; v < types.length; v++) {
		if (hardEdges[v].includes(v)) {
			throw new Error(
				`Cannot order generated classes: class ${types[v].className} extends itself. ` +
					`This indicates an invalid XSD type hierarchy.`,
			);
		}
		const inCycle = sccMembers[sccOf[v]].length > 1;
		for (const target of softEdges[v]) {
			if (target === v || (inCycle && sccOf[target] === sccOf[v])) {
				let refs = lazyRefs.get(types[v].className);
				if (!refs) {
					refs = new Set<string>();
					lazyRefs.set(types[v].className, refs);
				}
				refs.add(types[target].className);
			}
		}
	}
	return lazyRefs;
}

/**
 * Stable Kahn's algorithm over the SCC condensation DAG: always emit the ready
 * component whose smallest member index is lowest, so document order is
 * preserved wherever the dependency graph allows it.
 */
function orderCondensation(graph: DependencyGraph): ResolvedType[] {
	const { types, hardEdges, softEdges, sccOf, sccMembers } = graph;
	const sccCount = sccMembers.length;

	// Condensation DAG: component -> set of components it depends on.
	const sccDependencies: Array<Set<number>> = Array.from({ length: sccCount }, () => new Set());
	for (let v = 0; v < types.length; v++) {
		for (const target of [...hardEdges[v], ...softEdges[v]]) {
			if (sccOf[target] !== sccOf[v]) {
				sccDependencies[sccOf[v]].add(sccOf[target]);
			}
		}
	}

	const remainingDeps = sccDependencies.map((deps) => deps.size);
	const dependents: number[][] = Array.from({ length: sccCount }, () => []);
	for (let scc = 0; scc < sccCount; scc++) {
		for (const dep of sccDependencies[scc]) {
			dependents[dep].push(scc);
		}
	}

	const emitted: boolean[] = Array.from({ length: sccCount }, () => false);
	const sorted: ResolvedType[] = [];
	for (let step = 0; step < sccCount; step++) {
		let next = -1;
		for (let scc = 0; scc < sccCount; scc++) {
			if (emitted[scc] || remainingDeps[scc] > 0) continue;
			if (next === -1 || sccMembers[scc][0] < sccMembers[next][0]) {
				next = scc;
			}
		}
		/* v8 ignore next 3 -- unreachable: every digraph condensation is acyclic */
		if (next === -1) {
			throw new Error("Cannot order generated classes: dependency graph could not be linearized.");
		}

		emitted[next] = true;
		for (const member of orderSccMembers(sccMembers[next], hardEdges, sccOf, types)) {
			sorted.push(types[member]);
		}
		for (const dependent of dependents[next]) {
			remainingDeps[dependent]--;
		}
	}
	return sorted;
}

/**
 * Same-module clusters: connected components over hard edges that lie inside a
 * multi-member SCC (see TypeSortResult.sameModuleClusters). Cluster members and
 * the clusters themselves are listed in sorted (emit) order.
 */
function collectSameModuleClusters(graph: DependencyGraph, sorted: ResolvedType[]): string[][] {
	const { types, hardEdges, sccOf, sccMembers } = graph;
	const n = types.length;

	const parent = Array.from({ length: n }, (_, i) => i);
	const find = (x: number): number => {
		while (parent[x] !== x) {
			parent[x] = parent[parent[x]];
			x = parent[x];
		}
		return x;
	};
	for (let v = 0; v < n; v++) {
		if (sccMembers[sccOf[v]].length < 2) continue;
		for (const target of hardEdges[v]) {
			if (sccOf[target] === sccOf[v]) {
				parent[find(v)] = find(target);
			}
		}
	}

	const sortedPos = new Map<string, number>();
	sorted.forEach((t, i) => sortedPos.set(t.className, i));
	const clusterByRoot = new Map<number, number[]>();
	for (let v = 0; v < n; v++) {
		const root = find(v);
		const members = clusterByRoot.get(root);
		if (members) members.push(v);
		else clusterByRoot.set(root, [v]);
	}
	return [...clusterByRoot.values()]
		.filter((members) => members.length > 1)
		.map((members) =>
			members.map((v) => types[v].className).sort((a, b) => (sortedPos.get(a) ?? 0) - (sortedPos.get(b) ?? 0)),
		)
		.sort((a, b) => (sortedPos.get(a[0]) ?? 0) - (sortedPos.get(b[0]) ?? 0));
}

/**
 * Order the members of one SCC so hard (extends) edges are satisfied; soft
 * edges inside the SCC are emitted as thunks and need no ordering. If the hard
 * edges alone form a cycle, no declaration order can satisfy the extends
 * clauses and an error is raised.
 */
function orderSccMembers(members: number[], hardEdges: number[][], sccOf: number[], types: ResolvedType[]): number[] {
	if (members.length === 1) return members;

	const memberSet = new Set(members);
	const remainingDeps = new Map<number, number>();
	const dependents = new Map<number, number[]>();
	for (const v of members) {
		let deps = 0;
		for (const target of hardEdges[v]) {
			if (memberSet.has(target) && sccOf[target] === sccOf[v]) {
				deps++;
				const list = dependents.get(target);
				if (list) list.push(v);
				else dependents.set(target, [v]);
			}
		}
		remainingDeps.set(v, deps);
	}

	const ordered: number[] = [];
	const emitted = new Set<number>();
	while (ordered.length < members.length) {
		// Members are pre-sorted by original index, so the first ready one preserves document order.
		const next = members.find((v) => !emitted.has(v) && remainingDeps.get(v) === 0);
		if (next === undefined) {
			const cycleNames = members.filter((v) => !emitted.has(v)).map((v) => types[v].className);
			throw new Error(
				`Cannot order generated classes: inheritance (extends) cycle involving ${cycleNames.join(", ")}. ` +
					`This indicates an invalid XSD type hierarchy.`,
			);
		}
		emitted.add(next);
		ordered.push(next);
		for (const dependent of dependents.get(next) ?? []) {
			remainingDeps.set(dependent, (remainingDeps.get(dependent) ?? 0) - 1);
		}
	}
	return ordered;
}

/**
 * Tarjan's strongly-connected-components algorithm (iterative, to be safe on
 * deep dependency chains). Returns the component id per node; ids are then
 * only used for grouping, so their numbering order is irrelevant.
 */
function computeSccs(n: number, neighborsOf: (v: number) => number[]): number[] {
	const sccOf: number[] = Array.from({ length: n }, () => -1);
	const index: number[] = Array.from({ length: n }, () => -1);
	const lowlink: number[] = Array.from({ length: n }, () => -1);
	const onStack: boolean[] = Array.from({ length: n }, () => false);
	const stack: number[] = [];
	let nextIndex = 0;
	let nextScc = 0;

	for (let root = 0; root < n; root++) {
		if (index[root] !== -1) continue;

		// Explicit DFS stack: [node, position in its neighbor list]
		const work: Array<[number, number]> = [[root, 0]];
		while (work.length > 0) {
			const frame = work[work.length - 1];
			const [v, neighborPos] = frame;

			if (neighborPos === 0) {
				index[v] = nextIndex;
				lowlink[v] = nextIndex;
				nextIndex++;
				stack.push(v);
				onStack[v] = true;
			}

			const neighbors = neighborsOf(v);
			let advanced = false;
			for (let i = neighborPos; i < neighbors.length; i++) {
				const w = neighbors[i];
				if (index[w] === -1) {
					frame[1] = i + 1;
					work.push([w, 0]);
					advanced = true;
					break;
				}
				if (onStack[w]) {
					lowlink[v] = Math.min(lowlink[v], index[w]);
				}
			}
			if (advanced) continue;

			work.pop();
			if (work.length > 0) {
				const parent = work[work.length - 1][0];
				lowlink[parent] = Math.min(lowlink[parent], lowlink[v]);
			}
			if (lowlink[v] === index[v]) {
				let w: number;
				do {
					w = stack.pop() as number;
					onStack[w] = false;
					sccOf[w] = nextScc;
				} while (w !== v);
				nextScc++;
			}
		}
	}

	return sccOf;
}
