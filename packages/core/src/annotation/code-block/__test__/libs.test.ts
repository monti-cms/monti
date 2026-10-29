import { describe, expect, it } from "vitest";
import { __testable__ } from "../libs";
import type { AnnotationConfig } from "../types";

const { normalizeConfigItems, createAnnotationRegistry, supportsAnnotationScope } = __testable__;

describe("normalizeConfigItems / createAnnotationRegistry", () => {
	it("throws an error when annotationConfig is missing", () => {
		expect(() => createAnnotationRegistry(undefined)).toThrowError(
			"[createAnnotationRegistry] ERROR : annotationConfig is required",
		);
	});

	it("assigns defaults (source/scopes) and priority per type group", () => {
		const config: AnnotationConfig = {
			annotations: [
				{ name: "strong", kind: "class", class: "font-bold", source: "mdast", scopes: ["char", "document"] },
				{ name: "emphasis", kind: "class", class: "italic", scopes: ["char"] },
				{ name: "Tooltip", kind: "render", render: "Tooltip", scopes: ["char", "document"] },
				{ name: "diff", kind: "class", class: "diff", scopes: ["line"] },
				{ name: "Callout", kind: "render", render: "Callout", scopes: ["line"] },
			],
		};

		const normalized = normalizeConfigItems(config);
		expect(normalized).toMatchObject([
			{ name: "strong", source: "mdast", scopes: ["char", "document"], priority: 0, kind: "class" },
			{ name: "emphasis", source: "mdx-text", scopes: ["char"], priority: 1, kind: "class" },
			{ name: "Tooltip", source: "mdx-text", scopes: ["char", "document"], priority: 0, kind: "render" },
			{ name: "diff", source: "mdx-text", scopes: ["line"], priority: 0, kind: "class" },
			{ name: "Callout", source: "mdx-text", scopes: ["line"], priority: 0, kind: "render" },
		]);

		const registry = createAnnotationRegistry(config);
		// The registry holds every normalized item under its name.
		expect([...registry]).toEqual(normalized.map((item) => [item.name, item]));
		const item = (name: string) => registry.get(name) as NonNullable<ReturnType<typeof registry.get>>;

		expect(supportsAnnotationScope(item("strong"), "char")).toBe(true);
		expect(supportsAnnotationScope(item("Tooltip"), "document")).toBe(true);
		expect(supportsAnnotationScope(item("diff"), "line")).toBe(true);
		expect(supportsAnnotationScope(item("Callout"), "line")).toBe(true);
		expect(supportsAnnotationScope(item("emphasis"), "line")).toBe(false);
	});

	it("throws an error for a duplicate or invalid name", () => {
		expect(() =>
			normalizeConfigItems({
				annotations: [
					{ name: "dup", kind: "class", class: "a" },
					{ name: "dup", kind: "render", render: "X" },
				],
			}),
		).toThrowError('[createAnnotationRegistry] ERROR : duplicated annotation name "dup"');

		expect(() =>
			normalizeConfigItems({
				annotations: [{ name: "1bad", kind: "class", class: "a" }],
			}),
		).toThrowError('[createAnnotationRegistry] ERROR : invalid annotation name "1bad"');
	});
});
