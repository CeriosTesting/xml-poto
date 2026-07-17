/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { describe, expect, it, vi } from "vitest";

import { XmlDecoratorSerializer, XmlElement, XmlRoot } from "../../src";

describe("Choice groups (xs:choice)", () => {
	@XmlRoot({ name: "Notification" })
	class Notification {
		@XmlElement()
		title: string = "";

		@XmlElement({ choiceGroup: "contact", choiceRequired: true })
		email?: string;

		@XmlElement({ choiceGroup: "contact", choiceRequired: true })
		phone?: string;
	}

	it("should accept exactly one choice member", () => {
		const serializer = new XmlDecoratorSerializer();
		const notification = serializer.fromXml(
			"<Notification><title>Hi</title><email>a@b.c</email></Notification>",
			Notification,
		);
		expect(notification.email).toBe("a@b.c");
		expect(notification.phone).toBeUndefined();
	});

	it("should throw when multiple choice members are set during deserialization", () => {
		const serializer = new XmlDecoratorSerializer();
		expect(() =>
			serializer.fromXml(
				"<Notification><title>Hi</title><email>a@b.c</email><phone>123</phone></Notification>",
				Notification,
			),
		).toThrow(/Choice group 'contact'.*only one of/);
	});

	it("should throw when a required choice has no member set", () => {
		const serializer = new XmlDecoratorSerializer();
		expect(() => serializer.fromXml("<Notification><title>Hi</title></Notification>", Notification)).toThrow(
			/Choice group 'contact'.*must be set/,
		);
	});

	it("should throw when multiple choice members are set during serialization", () => {
		const serializer = new XmlDecoratorSerializer();
		const notification = new Notification();
		notification.title = "Hi";
		notification.email = "a@b.c";
		notification.phone = "123";
		expect(() => serializer.toXml(notification)).toThrow(/Choice group 'contact'.*only one of/);
	});

	it("should serialize a valid single choice member", () => {
		const serializer = new XmlDecoratorSerializer();
		const notification = new Notification();
		notification.title = "Hi";
		notification.phone = "123";
		const xml = serializer.toXml(notification);
		expect(xml).toContain("<phone>123</phone>");
		expect(xml).not.toContain("<email>");
	});

	it("should only warn under validationMode 'warn'", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const serializer = new XmlDecoratorSerializer({ validationMode: "warn" });
			const notification = serializer.fromXml(
				"<Notification><title>Hi</title><email>a@b.c</email><phone>123</phone></Notification>",
				Notification,
			);
			expect(notification.email).toBe("a@b.c");
			// Untyped optional properties keep the parser's numeric coercion
			expect(notification.phone).toBe(123 as any);
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Choice group 'contact'"));
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("should only warn with validationModeOverrides.choiceGroup while other rules stay strict", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const serializer = new XmlDecoratorSerializer({
				validationModeOverrides: { choiceGroup: "warn" },
			});
			const notification = serializer.fromXml(
				"<Notification><title>Hi</title><email>a@b.c</email><phone>123</phone></Notification>",
				Notification,
			);
			expect(notification.email).toBe("a@b.c");
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Choice group 'contact'"));
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("should skip choice validation with validationModeOverrides.choiceGroup 'off'", () => {
		const serializer = new XmlDecoratorSerializer({
			validationModeOverrides: { choiceGroup: "off" },
		});
		const notification = serializer.fromXml(
			"<Notification><title>Hi</title><email>a@b.c</email><phone>123</phone></Notification>",
			Notification,
		);
		expect(notification.email).toBe("a@b.c");
	});

	it("should not affect classes without choice groups", () => {
		@XmlRoot({ name: "Plain" })
		class Plain {
			@XmlElement()
			a?: string;

			@XmlElement()
			b?: string;
		}

		const serializer = new XmlDecoratorSerializer();
		const plain = serializer.fromXml("<Plain><a>one</a><b>two</b></Plain>", Plain);
		expect(plain.a).toBe("one");
		expect(plain.b).toBe("two");
	});
});
