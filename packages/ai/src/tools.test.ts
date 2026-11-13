import { createMonti, type Database, defineSchema } from "@monti-cms/core";
import type { Kysely } from "kysely";
import { describe, expect, it } from "vitest";
import { assistant } from "./operations";
import { assistantTools } from "./tools";

/** What Anthropic takes as a tool's input schema: an object, with no `anyOf`, `oneOf` or `allOf` beside it at the top. */
const isObjectAtTop = (schema: unknown) => {
	const top = schema as Record<string, unknown>;
	return top.type === "object" && !("anyOf" in top) && !("oneOf" in top) && !("allOf" in top);
};

/** A site with the assistant: no database is reached, only its operations are read. */
const site = () =>
	createMonti({
		db: {} as Kysely<Database>,
		schema: defineSchema({
			locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
			collections: {
				post: {
					kind: "document",
					path: "/posts/:slug",
					fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
				},
			},
		}),
		secret: "tools-test-secret-tools-test-secret",
		plugins: [assistant()],
	});

type Node = Record<string, unknown>;
/**
 * The definitions that name themselves again through parts that must all be given (Google refuses such a loop: it is taken only through
 * a part that can be left out, a value that can be null, or a list's items, which can be none). The ways a schema goes on: a required
 * property, a record's values, a branch of `anyOf`/`oneOf`/`allOf`, a `$ref`.
 */
function requiredLoops(schema: unknown): string[] {
	const defs = ((schema as Node).$defs ?? {}) as Record<string, Node>;
	const loops: string[] = [];
	const walk = (node: unknown, start: string, seen: Set<string>) => {
		if (typeof node !== "object" || node === null) return;
		const at = node as Node;
		if (Array.isArray(at.type) && at.type.includes("null")) return;
		if (typeof at.$ref === "string") {
			const name = at.$ref.replace("#/$defs/", "");
			if (name === start) loops.push(start);
			else if (!seen.has(name)) walk(defs[name], start, new Set([...seen, name]));
			return;
		}
		const required = new Set((at.required as string[] | undefined) ?? []);
		for (const [key, value] of Object.entries((at.properties ?? {}) as Node))
			if (required.has(key)) walk(value, start, seen);
		if (typeof at.additionalProperties === "object") walk(at.additionalProperties, start, seen);
		for (const branches of [at.anyOf, at.oneOf, at.allOf])
			if (Array.isArray(branches)) for (const branch of branches) walk(branch, start, seen);
	};
	for (const [name, def] of Object.entries(defs)) walk(def, name, new Set([name]));
	return loops;
}

describe("the assistant's tools (T161)", () => {
	it("10-1 every tool's input is an object at the top: a model service refuses the whole request over one that is not", () => {
		// Anthropic answered 400 to every turn while `activity.undoPlan` and `deliveries.retry` took unions (`anyOf` at the top).
		const tools = assistantTools(site());
		expect(tools.map((tool) => tool.operation)).toContain("activity.undoPlan");
		expect(tools.filter((tool) => !isObjectAtTop(tool.inputSchema)).map((tool) => tool.operation)).toEqual([]);
	});

	it("10-1 no tool's input names itself again only through parts that must be given: Google refuses the whole request over one", () => {
		// Google answered 400 to every turn while a conditional field's groups were required: a group may hold another conditional field.
		const tools = assistantTools(site());
		expect(tools.map((tool) => tool.operation)).toContain("schema.check");
		expect(
			tools.flatMap((tool) => requiredLoops(tool.inputSchema).map((loop) => `${tool.operation}: ${loop}`)),
		).toEqual([]);
	});
});
