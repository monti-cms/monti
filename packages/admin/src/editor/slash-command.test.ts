import { createTranslator } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { editorMessages } from "./messages";
import { filterCommands } from "./slash-command";

const t = createTranslator(editorMessages);
/** First search term of a dictionary (in each language's own words). */
const firstKeyword = (key: Parameters<typeof t>[0]) => t(key).split(",")[0] ?? "";

describe("Slash Menu Commands & Filter Contract", () => {
	it("filters accurately with English queries", () => {
		const h2Results = filterCommands("h2");
		expect(h2Results.map((c) => c.title)).toContain(t("slash.h2.title"));
		// The post title is H1, so heading insertion in the body starts at H2.
		expect(filterCommands("h1")).toHaveLength(0);

		expect(filterCommands("table").some((c) => c.title.includes(t("slash.table.title")))).toBe(true);
		expect(filterCommands("todo").some((c) => c.title.includes(t("slash.todo.title").split(" ")[0] ?? ""))).toBe(true);

		const codeResults = filterCommands("code");
		expect(codeResults.some((c) => c.title.includes(t("slash.code.title").split(" ")[0] ?? ""))).toBe(true);
	});

	it("filters accurately with Korean queries", () => {
		const titleResults = filterCommands(firstKeyword("slash.heading.keywords"));
		expect(titleResults.length).toBeGreaterThanOrEqual(3); // H2, H3, H4

		const quoteResults = filterCommands(firstKeyword("slash.quote.keywords"));
		expect(quoteResults.some((c) => c.title.includes(t("slash.quote.title")))).toBe(true);

		const listResults = filterCommands(firstKeyword("slash.bullet.keywords"));
		expect(listResults.length).toBeGreaterThanOrEqual(2); // Bullet, Ordered
	});
});
