import { describe, expect, it } from "vitest";
import { __testable__ } from "../libs";
import type { AnnotationConfig } from "../types";

const { normalizeConfigItems, createAnnotationRegistry, supportsAnnotationScope } = __testable__;

describe("normalizeConfigItems / createAnnotationRegistry", () => {
	it("annotationConfig가 없으면 에러를 던진다", () => {
		expect(() => createAnnotationRegistry(undefined)).toThrowError(
			"[createAnnotationRegistry] ERROR : annotationConfig is required",
		);
	});

	it("기본값(source/scopes)과 priority를 type 그룹별로 부여한다", () => {
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
		const strong = registry.get("strong");
		const tooltip = registry.get("Tooltip");
		const diff = registry.get("diff");
		const callout = registry.get("Callout");

		expect(strong).toBeDefined();
		expect(tooltip).toBeDefined();
		expect(diff).toBeDefined();
		expect(callout).toBeDefined();
		if (!strong || !tooltip || !diff || !callout) {
			throw new Error("Expected annotation registry items to exist");
		}

		expect(supportsAnnotationScope(strong, "char")).toBe(true);
		expect(supportsAnnotationScope(tooltip, "document")).toBe(true);
		expect(supportsAnnotationScope(diff, "line")).toBe(true);
		expect(supportsAnnotationScope(callout, "line")).toBe(true);
		expect(registry.get("strong")?.kind).toBe("class");
		expect(registry.get("Tooltip")?.kind).toBe("render");
	});

	it("중복/잘못된 name은 에러를 던진다", () => {
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
