import { describe, it } from "vitest";

describe("the language tabs", () => {
	it.todo(
		"[overflow-after-add] with five languages the tabs and '+ 언어' still fit the writing column, and nothing scrolls sideways",
	);
	it.todo("T68 an entry of a two-language site shows its languages as tabs, its own pressed, and '+ 언어' after them");
	it.todo("T68 a tab opens that language's entry of the group");
	it.todo("T68 a one-language site's editor has no language tabs");
});

describe("flow 3, a translation", () => {
	it.todo("04-1 3.01 '+ 언어' lists the languages the group lacks with their codes, and '언어 관리'");
	it.todo("04-1 3.14 with every language already there, the menu has only '언어 추가 · 설정'");
	it.todo(
		"04-1 3.02 picking a language opens the new translation: every block faint, the address copied, one to-do open",
	);
	it.todo("04-1 3.04 a faint block's menu keeps it in the source's words or removes it; typing into it translates it");
	it.todo(
		"04-1 3.05 the source shows beside the translation, and side by side each source block sits on the row of its pair",
	);
	it.todo("04-1 3.06 publishing with a faint block left is refused, and the to-do row moves to that block");
	it.todo("04-1 3.07 with every block decided the translation publishes under /en/…");
	it.todo("04-1 3.08 after the source is published again, the English tab has a dot");
	it.todo(
		"04-1 3.09 the translation shows a margin mark on each changed, added and removed block, and a banner with '모두 확인'",
	);
	it.todo("04-1 3.10 a mark opens the source before and after, and '확인' clears that mark");
	it.todo("04-5 a 'same' field shows the source's value as text in the translation's properties, with no input");
});
