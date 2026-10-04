import { createTranslator } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { editorMessages } from "./messages";
import { filterCommands, SLASH_COMMANDS } from "./slash-command";

const t = createTranslator(editorMessages);
/** 사전의 첫 검색어(언어마다 그 언어의 말이다). */
const firstKeyword = (key: Parameters<typeof t>[0]) => t(key).split(",")[0] ?? "";

describe("Slash Menu Commands & Filter Contract", () => {
	it("returns all commands when query is empty", () => {
		expect(filterCommands("")).toHaveLength(SLASH_COMMANDS.length);
	});

	it("filters accurately with English queries", () => {
		const h2Results = filterCommands("h2");
		expect(h2Results.map((c) => c.title)).toEqual([t("slash.h2.title")]);
		// 글 제목이 H1이므로 본문 제목 삽입은 H2부터다(§4.1).
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
