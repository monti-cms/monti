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

describe("the assistant's tools (T161)", () => {
	it("10-1 every tool's input is an object at the top: a model service refuses the whole request over one that is not", () => {
		// Anthropic answered 400 to every turn while `activity.undoPlan` and `deliveries.retry` took unions (`anyOf` at the top).
		const monti = createMonti({
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
		const tools = assistantTools(monti);
		expect(tools.map((tool) => tool.operation)).toContain("activity.undoPlan");
		expect(tools.filter((tool) => !isObjectAtTop(tool.inputSchema)).map((tool) => tool.operation)).toEqual([]);
	});
});
