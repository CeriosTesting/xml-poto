# esbuild/Playwright Compatibility Guide

## Issue

When using `@XmlDynamic` decorator in environments that use **esbuild** for TypeScript compilation (such as Playwright tests), you may encounter the following issue:

```typescript
@XmlRoot({ name: 'Document' })
class Document {
  @XmlDynamic({ lazyLoad: false })
  dynamic!: DynamicElement;
}

const doc = new Document();
console.log(doc.dynamic); // undefined ❌
```

**Root Cause:** esbuild doesn't fully support Stage 3 decorators yet. The decorator function doesn't execute properly, so the property descriptor with getter/setter is never created.

## Solution: Manual Initialization

Use the `initializeDynamicProperty` helper function to manually initialize `@XmlDynamic` properties in the constructor:

### Option 1: Initialize Individual Properties

```typescript
import { XmlRoot, XmlDynamic, initializeDynamicProperty, DynamicElement } from '@cerios/xml-poto';

@XmlRoot({ name: 'Document' })
class Document {
  @XmlDynamic({ lazyLoad: false })
  dynamic!: DynamicElement;

  constructor() {
    // Manually initialize when decorators don't work
    initializeDynamicProperty(this, 'dynamic');
  }
}

const doc = new Document();
console.log(doc.dynamic); // DynamicElement { name: 'Document', ... } ✅
```

### Option 2: Initialize All Properties at Once

```typescript
import { XmlRoot, XmlDynamic, initializeAllDynamicProperties, DynamicElement } from '@cerios/xml-poto';

@XmlRoot({ name: 'Container' })
class Container {
  @XmlDynamic({ lazyLoad: false })
  dynamic1!: DynamicElement;

  @XmlDynamic({ lazyLoad: false })
  dynamic2!: DynamicElement;

  constructor() {
    // Initialize all @XmlDynamic properties at once
    initializeAllDynamicProperties(this);
  }
}

const container = new Container();
console.log(container.dynamic1); // ✅ Works
console.log(container.dynamic2); // ✅ Works
```

### Option 3: Conditional Initialization (Safe for All Environments)

If you want code that works both in environments where decorators work AND where they don't:

```typescript
import { XmlRoot, XmlDynamic, initializeDynamicProperty, DynamicElement } from '@cerios/xml-poto';

@XmlRoot({ name: 'Document' })
class Document {
  @XmlDynamic({ lazyLoad: false })
  dynamic!: DynamicElement;

  constructor() {
    // Only initialize if decorator didn't run
    if (!Object.getOwnPropertyDescriptor(this, 'dynamic')?.get) {
      initializeDynamicProperty(this, 'dynamic');
    }
  }
}
```

## How It Works

The `initializeDynamicProperty` function:

1. Retrieves the decorator metadata (even if decorators didn't fully execute)
2. Creates the same getter/setter property descriptor that the decorator would have created
3. Uses Symbol-based storage to avoid conflicts with TypeScript's field initialization
4. Supports both lazy loading and immediate loading modes

## Playwright Example

```typescript
// document.spec.ts
import { test, expect } from '@playwright/test';
import { XmlRoot, XmlDynamic, initializeDynamicProperty, DynamicElement } from '@cerios/xml-poto';

@XmlRoot({ name: 'TestDoc' })
class TestDoc {
  @XmlDynamic({ lazyLoad: false })
  dynamic!: DynamicElement;

  constructor() {
    initializeDynamicProperty(this, 'dynamic');
  }
}

test('should work with manual initialization', () => {
  const doc = new TestDoc();

  expect(doc.dynamic).toBeDefined();
  expect(doc.dynamic.name).toBe('TestDoc');

  doc.dynamic.createChild({ name: 'Child', text: 'content' });
  expect(doc.dynamic.children.length).toBe(1);
});
```

## Why This Happens

esbuild transforms decorators differently than the TypeScript compiler:

- **TypeScript (tsc):** Fully supports Stage 3 decorators and generates proper decorator calls
- **esbuild:** Has limited support for decorators, especially field decorators
- **Result:** The `@XmlDynamic` decorator's `addInitializer` callback doesn't run, so no getter/setter is created

## Alternative: Use TypeScript Compiler

If manual initialization is not desirable, you can configure Playwright to use TypeScript compiler instead of esbuild:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Force TypeScript compilation instead of esbuild
  },
  // Note: This will be slower than esbuild
});
```

However, this may slow down your test execution.

## Best Practice

For maximum compatibility, always use manual initialization in Playwright tests:

```typescript
class MyClass {
  @XmlDynamic({ lazyLoad: false })
  dynamic!: DynamicElement;

  constructor() {
    // Always safe, works everywhere
    initializeDynamicProperty(this, 'dynamic');
  }
}
```

This ensures your code works in:
- ✅ Regular TypeScript projects (tsc)
- ✅ Webpack/Rollup/Vite builds
- ✅ esbuild environments
- ✅ Playwright tests
- ✅ Jest with ts-jest
- ✅ Any bundler or test framework
