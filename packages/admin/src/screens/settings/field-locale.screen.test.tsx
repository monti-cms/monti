import { defineSchema } from "@monti-cms/core";
import { composeStories, composeStory } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { schema } from "../story-schema";
import * as collections from "./collections.stories";

const { Fields } = composeStories(collections);

/** The same blog in Korean only. */
const oneLanguage = defineSchema({
	...schema,
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
});

const sheet = () => page.getByRole("dialog");
const language = () => sheet().getByRole("combobox", { name: "언어" });

/** Opens a field's sheet from the posts' field list. */
async function openField(name: string) {
	await userEvent.click(page.getByRole("button", { name: `${name} 열기`, exact: true }));
	await expect.element(sheet()).toBeVisible();
}

async function close() {
	await userEvent.click(sheet().getByRole("button", { name: "취소" }));
	await expect.element(sheet()).not.toBeInTheDocument();
}

describe("the field sheet's language", () => {
	it("T46 the field sheet shows '언어' only when the site has two or more languages", async () => {
		await Fields.run();
		await openField("summary");
		await expect.element(language()).toBeVisible();

		await composeStory(
			{ ...collections.Fields, loaders: collections.site({ schema: oneLanguage }) },
			collections.default,
		).run();
		await openField("summary");
		// The rules are there, the language is not.
		await expect.element(sheet().getByRole("switch", { name: /필수/ })).toBeVisible();
		await expect.element(language()).not.toBeInTheDocument();
		expect(sheet().element().textContent).not.toContain("언어");
	});

	it("T46 a title's language reads 'per language' and an address's 'from the source' when the schema names none", async () => {
		await Fields.run();
		for (const [field, mode] of [
			["title", "언어마다"],
			["slug", "원문 따름"],
			["subtitle", "모두 같음"],
		]) {
			await openField(field as string);
			await expect.element(language()).toHaveTextContent(mode as string);
			await close();
		}
	});

	it("T46 a field saved with its language left at the default writes no language; picking another one is a change", async () => {
		await Fields.run();
		await openField("title");
		await userEvent.click(sheet().getByRole("button", { name: "저장" }));
		await expect.element(sheet()).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "바뀐 곳" })).not.toBeInTheDocument();

		await openField("title");
		await userEvent.click(language());
		await userEvent.click(page.getByRole("option", { name: "모두 같음" }));
		await userEvent.click(sheet().getByRole("button", { name: "저장" }));
		await expect.element(page.getByRole("button", { name: "바뀐 곳" })).toBeVisible();
	});
});
