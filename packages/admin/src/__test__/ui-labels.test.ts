import { DEFAULT_UI_LABELS } from "@monti-cms/ui";
import { describe, expect, it } from "vitest";
import { KO_UI_LABELS } from "../../../ui/.storybook/ko-labels";
import { adminMessages } from "../messages";

/** The `ui.*` words of one of the admin's dictionaries, by the label's name. */
const uiWords = (language: "en" | "ko") =>
	Object.fromEntries(
		Object.entries(adminMessages.messages[language] as Record<string, string>)
			.filter(([key]) => key.startsWith("ui."))
			.map(([key, words]) => [key.slice(3), words]),
	);

describe("the words the design system's parts write themselves", () => {
	it("the admin gives every label the parts have, and no other", () => {
		const names = Object.keys(DEFAULT_UI_LABELS).sort();
		expect(Object.keys(uiWords("en")).sort()).toEqual(names);
		expect(Object.keys(uiWords("ko")).sort()).toEqual(names);
	});

	it("Storybook's Korean labels are the admin's Korean words", () => {
		expect(KO_UI_LABELS).toEqual(uiWords("ko"));
	});
});
