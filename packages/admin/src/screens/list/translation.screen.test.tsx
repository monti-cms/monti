import { composeStories, composeStory } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { StorySite } from "../../../.storybook/pglite-site";
import type { ScreenChannel } from "../../operations/admin-context";
import * as list from "./list.stories";

type Loaded = { site: StorySite; screen: ScreenChannel };

const { Main, OneLanguage } = composeStories(list);

/** A story with the translated posts, run with its site at hand: the test reads what the operations say about the same rows. */
function withSite(story: typeof list.Main, hash: string) {
	const held: { loaded?: Loaded } = {};
	const [load] = list.site(list.translated, hash) as [() => Promise<Loaded>];
	const composed = composeStory(
		{
			...story,
			loaders: [
				async () => {
					held.loaded = await load();
					return held.loaded;
				},
			],
		},
		list.default,
	);
	return {
		run: () => composed.run(),
		loaded: () => {
			if (!held.loaded) throw new Error("the story has not loaded");
			return held.loaded;
		},
	};
}

const column = (name: string) => page.getByRole("button", { name, exact: true });
const languageHead = () => document.querySelector<HTMLElement>("th[data-column=locale]");
const dotted = () => languageHead()?.querySelector("[data-slot=column-dot]") !== null;
const menuRow = (name: RegExp) => page.getByRole("menuitemcheckbox", { name });
/** The count at the end of a menu row ("원문 변경 2" → 2). */
const countOf = (name: RegExp) =>
	Number(/(\d+)\s*$/.exec(menuRow(name).element().textContent ?? "")?.[1] ?? Number.NaN);
const TRANSLATION_ROWS = [/^번역 없음/, /^원문 변경/, /^최신/];

async function openLanguageMenu() {
	await expect.element(column("언어")).toBeVisible();
	await userEvent.click(column("언어"));
	await expect.element(menuRow(/^원문 변경/)).toBeVisible();
}

describe("the list's language column", () => {
	it("T52 a two-language site's list has the language column; a one-language site's has none", async () => {
		await Main.run();
		await expect.element(page.getByText("발행 후 고친 글")).toBeVisible();
		await expect.element(column("언어")).toBeVisible();
		await expect.element(page.getByText("KO +2").first()).toBeVisible();

		await OneLanguage.run();
		await expect.element(page.getByText("발행 후 고친 글")).toBeVisible();
		await expect.element(column("상태")).toBeVisible();
		expect(languageHead()).toBeNull();
		await expect.element(page.getByText(/^KO/).first()).not.toBeInTheDocument();
	});

	it("T52 on a one-language site a language or translation filter in the address is left out, and the rows show", async () => {
		const story = composeStory(
			{
				...list.OneLanguage,
				loaders: list.site(undefined, "#/c/post?locale=en&translation=missing", { schema: list.oneLanguage }),
			},
			list.default,
		);
		await story.run();
		await expect.element(page.getByText("발행 후 고친 글")).toBeVisible();
		// A full first page: the filter the address named was dropped, not applied.
		await expect.element(page.getByText(/^1–25 \/ \d+$/)).toBeVisible();
	});

	it("04-1 3.12 the language menu counts each language and the translation filters: missing, source changed, up to date", async () => {
		await withSite(list.Main, "#/c/post").run();
		await openLanguageMenu();
		const rows = (await page.getByRole("menuitemcheckbox").all()).map((row) => row.element().textContent ?? "");
		// The languages by name, each with a count, then the translation filters in their order.
		expect(rows.slice(0, 3).map((row) => row.replace(/\d+$/, ""))).toEqual(["한국어", "영어", "일본어"]);
		expect(rows.slice(3).map((row) => row.replace(/\d+$/, ""))).toEqual(["번역 없음", "원문 변경", "최신"]);
		for (const row of rows) expect(row).toMatch(/\d+$/);
		await expect.element(page.getByRole("menu").getByText("번역", { exact: true })).toBeVisible();
		// A group that lacks a language is never up to date.
		const total = countOf(/^한국어/);
		expect(countOf(/^번역 없음/) + countOf(/^최신/)).toBeLessThanOrEqual(total);
		expect(countOf(/^원문 변경/)).toBe(list.translatedPosts.filter((post) => post.changed).length);
	});

	it("04-1 3.12 picking 'source changed' leaves the groups with a changed translation and dots the language column; the assistant's same filter reads '번역: 원문 변경' on its chip", async () => {
		const story = withSite(list.Main, "#/c/post");
		await story.run();
		await openLanguageMenu();
		const counted = countOf(/^원문 변경/);
		await userEvent.click(menuRow(/^원문 변경/));
		await expect.element(menuRow(/^원문 변경/)).toHaveAttribute("aria-checked", "true");
		await expect.poll(() => window.location.hash).toContain("translation=sourceChanged");
		const changed = list.translatedPosts.filter((post) => post.changed).map((post) => post.title);
		await expect.element(page.getByText(`1–${counted} / ${counted}`)).toBeVisible();
		for (const title of changed) await expect.element(page.getByRole("link", { name: title })).toBeVisible();
		expect(dotted()).toBe(true);
		// A person's filter is the dot and the check, never a chip (components/list.md).
		await expect.element(page.getByText("번역: 원문 변경")).not.toBeInTheDocument();

		// Picking another one adds it, as in every column's menu: the rows of either are left. Picking each again takes it off.
		await userEvent.click(menuRow(/^번역 없음/));
		await expect.poll(() => window.location.hash).toContain("translation=missing%2CsourceChanged");
		await expect.element(menuRow(/^원문 변경/)).toHaveAttribute("aria-checked", "true");
		await expect.element(menuRow(/^번역 없음/)).toHaveAttribute("aria-checked", "true");
		const both = countOf(/^원문 변경/) + countOf(/^번역 없음/);
		await expect.element(page.getByText(`/ ${both}`, { exact: false })).toBeVisible();
		await userEvent.click(menuRow(/^번역 없음/));
		await userEvent.click(menuRow(/^원문 변경/));
		await expect.poll(() => window.location.hash).not.toContain("translation=");
		await expect.poll(dotted).toBe(false);
		await userEvent.keyboard("{Escape}");

		story
			.loaded()
			.screen.run("list.show", { collection: "post", filters: [{ on: "translation", any: ["sourceChanged"] }] });
		await expect.element(page.getByText("번역: 원문 변경")).toBeVisible();
		for (const title of changed) await expect.element(page.getByRole("link", { name: title })).toBeVisible();
	});

	it("04-4 the language menu's translation counts are the groups translations.status reports for the same rows", async () => {
		const story = withSite(list.Main, "#/c/post");
		await story.run();
		await openLanguageMenu();
		const { monti } = story.loaded().site;
		// The rows a pick would list: a filter at the top of a collection with folders looks through every folder (doc 06, LT-12), and so
		// does the menu's count.
		const { rows } = await list.run<{ rows: { id: string }[] }>(monti, "entries.query", {
			collection: "post",
			folder: null,
			scope: "all",
			pageSize: 500,
		});
		const { groups } = await list.run<{
			groups: { locales: { locale: string; changes: number }[]; missing: string[] }[];
		}>(monti, "translations.status", { ids: rows.map((row) => row.id) });
		expect(groups).toHaveLength(rows.length);
		const missing = groups.filter((group) => group.missing.length > 0).length;
		const sourceChanged = groups.filter((group) => group.locales.some((locale) => locale.changes > 0)).length;
		const upToDate = groups.filter(
			(group) => group.missing.length === 0 && group.locales.every((locale) => locale.changes === 0),
		).length;
		expect(TRANSLATION_ROWS.map(countOf)).toEqual([missing, sourceChanged, upToDate]);
		// The data has each kind, so the comparison means something.
		expect(Math.min(missing, sourceChanged, upToDate)).toBeGreaterThan(0);
	});
});
