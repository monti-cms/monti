import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { dragPath, dropDrag, middleOf } from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import { MontiAdmin } from "../../app";
import * as stories from "./settings.stories";

const {
	Languages,
	LanguageAdded,
	LanguageProposal,
	LanguageRemoved,
	LanguagesLive,
	SiteChanged,
	SiteProposal,
	SourceChanged,
} = composeStories(stories);

type Loaded = { site: StorySite };
/** The stories' languages, as the story schema has them. */
const LANGUAGES = [
	{ code: "ko", name: "한국어" },
	{ code: "en", name: "English" },
	{ code: "ja", name: "日本語" },
];
const admin = { actor: "admin" } as const;

/** A story drawn with its site at hand, to read what the operations say after the screen saved. */
const withSite = (story: object) => scene<Loaded>(story, stories.default);

type Settings = {
	site: { name: string; writing: string };
	admin: { language: string | null; templates: boolean };
	schema: {
		locales: { source: string; prefix: string; list: { code: string }[] };
		collections: Record<string, { fields: Record<string, unknown> }>;
	};
};
const settingsOf = (loaded: Loaded) => loaded.site.monti.run("settings.read", {}, admin) as Promise<Settings>;
const codes = (settings: Settings) => settings.schema.locales.list.map((locale) => locale.code);

const tab = (name: RegExp) => page.getByRole("link", { name });
const saveGroup = () => page.getByRole("button", { name: /^저장/ });
const nameField = () => page.getByRole("textbox", { name: "사이트 이름" });
/** The menu beside a collection's new-entry pill, there only when it has something to offer. */
const MORE_NEW = "더 만들기";
/** The site's name over the sidebar. */
const siteName = () => document.querySelector("[data-slot=sidebar-header]")?.textContent;
/** The languages in the order the tab shows them, by their own names. */
const languages = () =>
	[...document.querySelectorAll("[data-slot=language-row]")].map((row) => row.querySelector("span span")?.textContent);
const topOf = (name: string) =>
	Math.round(
		[...document.querySelectorAll("[data-slot=language-row]")]
			.find((row) => row.querySelector("span span")?.textContent === name)
			?.getBoundingClientRect().top ?? Number.NaN,
	);
/** What the screen reader was last told about a drag. */
const said = () => document.querySelector("[id^=DndLiveRegion]")?.textContent ?? "";

describe("settings: four tabs over one draft", () => {
	it("12-1 a change on the site tab is counted on the other tabs, its tab carries the dot from there, and moving between tabs asks nothing", async () => {
		await SiteChanged.run();
		await userEvent.click(tab(/언어/));
		await expect.element(page.getByRole("button", { name: "+ 언어 추가" })).toBeVisible();
		await expect.element(saveGroup()).toBeVisible();
		await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
		// The dot is on the tab that holds the change, and only while another tab is open.
		await expect.element(tab(/사이트/).getByRole("img", { name: "변경" })).toBeVisible();
		await userEvent.click(tab(/사이트/));
		await expect.element(nameField()).toHaveValue("example.blog");
		await expect.element(tab(/사이트/).getByRole("img", { name: "변경" })).not.toBeInTheDocument();
	});

	it("12-1 [flow 11·04] leaving settings with a change asks first; 계속 고치기 stays, with the change still there", async () => {
		await SiteChanged.run();
		await userEvent.click(page.getByRole("button", { name: /게시글/ }));
		await expect.element(page.getByRole("alertdialog")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "계속 고치기" }));
		await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
		await expect.element(nameField()).toHaveValue("example.blog");
	});

	it("12-2 [flow 11·15b] a site name saved on the dev server: no review opens, the toast says saved, and the sidebar and the settings hold the new name", async () => {
		const shown = withSite(stories.SiteChanged);
		await shown.run();
		await userEvent.click(saveGroup());
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
		await expect.element(saveGroup()).not.toBeInTheDocument();
		await expect.poll(siteName).toBe("example.blog");
		expect((await settingsOf(shown.loaded())).site.name).toBe("example.blog");
	});

	it("12-1 the name's undo on its label row puts the saved name back, and the save group goes with the last change", async () => {
		await SiteChanged.run();
		await userEvent.click(page.getByRole("button", { name: "되돌리기", exact: true }));
		await expect.element(nameField()).toHaveValue("example.dev");
		await expect.element(saveGroup()).not.toBeInTheDocument();
	});

	it("12-3 [flow 11·15b] on the live site the pill says 저장 and a name is saved at once", async () => {
		const shown = withSite(stories.SiteLiveChanged);
		await shown.run();
		await userEvent.click(page.getByRole("button", { name: "저장", exact: true }));
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		expect((await settingsOf(shown.loaded())).site.name).toBe("example.blog");
	});
});

describe("settings › languages", () => {
	it("12-1 [flow 11·05] '+ 언어 추가' finds codes as they are typed, and does not offer a language the site has", async () => {
		await Languages.run();
		await userEvent.click(page.getByRole("button", { name: "+ 언어 추가" }));
		await userEvent.type(page.getByRole("combobox"), "zh");
		await expect.element(page.getByRole("option", { name: /zh-Hans/ })).toBeVisible();
		await expect.element(page.getByRole("option", { name: /zh-HK/ })).toBeVisible();
		await userEvent.clear(page.getByRole("combobox"));
		await userEvent.type(page.getByRole("combobox"), "en");
		// English is the site's already; its regional forms are other languages.
		await expect.element(page.getByRole("option", { name: /en-GB/ })).toBeVisible();
		expect(document.querySelector("[cmdk-item][data-value='en']")).toBeNull();
	});

	it("12-1 [flow 11·06] a language picked is a row at once; taken out again before the save, it leaves no change behind", async () => {
		await LanguageAdded.run();
		expect(languages()).toEqual(["한국어", "English", "日本語", "Deutsch"]);
		await expect.element(saveGroup()).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "Deutsch 빼기" }));
		await expect.poll(languages).toEqual(["한국어", "English", "日本語"]);
		await expect.element(saveGroup()).not.toBeInTheDocument();
	});

	it("12-1 [flow 11·07b] another source picked stands first; the old source gets its handle and ×, the new one loses them", async () => {
		await SourceChanged.run();
		expect(languages()).toEqual(["English", "한국어", "日本語"]);
		await expect.element(page.getByRole("button", { name: "한국어 옮기기" })).toBeVisible();
		await expect.element(page.getByRole("button", { name: "한국어 빼기" })).toBeVisible();
		await expect.element(page.getByRole("button", { name: "English 빼기" })).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "English 옮기기" })).not.toBeInTheDocument();
	});

	it("12-1 [flow 11·08] a language taken out stays as a struck row; its undo puts it back and the save group goes", async () => {
		await LanguageRemoved.run();
		expect(languages()).toEqual(["한국어", "English", "日本語"]);
		await expect.element(page.getByRole("button", { name: "English 빼기" })).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("list", { name: "콘텐츠 언어" }).getByRole("button", { name: "되돌리기" }));
		await expect.element(page.getByRole("button", { name: "English 빼기" })).toBeVisible();
		await expect.element(saveGroup()).not.toBeInTheDocument();
	});

	it("12-1 [flow 11·08] saving with a language taken out asks with the red 지우고 적용 alone, and applying takes the language and its translations out of the site", async () => {
		const english: { id?: string } = {};
		const shown = withSite({
			...stories.LanguageRemoveReview,
			loaders: stories.settingsAt("languages", {
				// A post with an English translation, both on the site: what the removal has to take.
				more: async ({ monti }) => {
					const made = (await monti.run(
						"entries.create",
						{ collection: "post", title: "번역이 있는 글", slug: "translated" },
						admin,
					)) as { output: { id: string } };
					await monti.run("entries.publish", { ids: [made.output.id] }, admin);
					const translated = (await monti.run(
						"translations.create",
						{ source: made.output.id, locale: "en" },
						admin,
					)) as { output: { id: string } };
					const got = (await monti.run("entries.get", { id: translated.output.id }, admin)) as {
						entry: { version: number };
					};
					await monti.run(
						"entries.save",
						{ id: translated.output.id, version: got.entry.version, title: "A translated post" },
						admin,
					);
					await monti.run("entries.publish", { ids: [translated.output.id] }, admin);
					english.id = translated.output.id;
				},
			}),
		});
		await shown.run();
		const { db } = shown.loaded().site;
		const inEnglish = async () => ({
			working: (await db.selectFrom("entries").select("id").where("locale", "=", "en").execute()).map((row) => row.id),
			onSite: (await db.selectFrom("entry_published").select("entry_id").where("locale", "=", "en").execute()).map(
				(row) => row.entry_id,
			),
		});
		expect(await inEnglish()).toEqual({ working: [english.id], onSite: [english.id] });
		await expect.element(page.getByText("번역이 함께 지워집니다.")).toBeVisible();
		await expect.element(page.getByRole("radio")).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "지우고 적용" }));
		await expect.element(page.getByText("적용했습니다")).toBeVisible();
		expect(codes(await settingsOf(shown.loaded()))).toEqual(["ko", "ja"]);
		expect(await inEnglish()).toEqual({ working: [], onSite: [] });
		await expect.poll(languages).toEqual(["한국어", "日本語"]);
	});

	it("12-1 the old source taken out in the save that makes another the source: the review promises the drafts, and they are there after", async () => {
		const shown = withSite(stories.SourceChanged);
		await shown.run();
		const { db } = shown.loaded().site;
		const titles = async (locale: string) =>
			(await db.selectFrom("entries").select("title").where("locale", "=", locale).orderBy("title").execute()).map(
				(row) => row.title,
			);
		const korean = await titles("ko");
		expect(korean).toHaveLength(3);
		expect(await titles("en")).toEqual([]);
		// English is the source now; Korean, the source until this save, is taken out with its ×.
		await userEvent.click(page.getByRole("button", { name: "한국어 빼기" }));
		await userEvent.click(saveGroup());
		await expect.element(page.getByText("이 언어 글이 없는 3편에 초안이 생깁니다.")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "지우고 적용" }));
		await expect.element(page.getByText("적용했습니다")).toBeVisible();
		// The three posts are English drafts made from the Korean ones before those left.
		expect(await titles("en")).toEqual(korean);
		expect(await titles("ko")).toEqual([]);
		expect((await settingsOf(shown.loaded())).schema.locales).toMatchObject({ source: "en" });
		expect(codes(await settingsOf(shown.loaded()))).toEqual(["en", "ja"]);
	});

	it("12-1 one review holds the languages' changes and the collections': the plain 적용 writes them all in one save", async () => {
		const shown = withSite(stories.OneReview);
		await shown.run();
		const sheet = page.getByRole("dialog");
		for (const title of ["Deutsch", "English", "주소에 언어 표시", "kicker"])
			await expect.element(sheet.getByText(title, { exact: true }).first()).toBeVisible();
		await expect.element(page.getByRole("button", { name: "지우고 적용" })).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "적용", exact: true }));
		await expect.element(page.getByText("적용했습니다")).toBeVisible();
		const settings = await settingsOf(shown.loaded());
		expect(settings.schema.locales.source).toBe("en");
		expect(settings.schema.locales.prefix).toBe("always");
		expect(codes(settings)).toContain("de");
		expect(Object.keys(settings.schema.collections.post?.fields ?? {})).toContain("kicker");
		const activity = await shown.loaded().site.db.selectFrom("monti_activity").select("operation").execute();
		expect(activity.filter((row) => row.operation === "settings.save")).toHaveLength(2);
	});

	it("[keys-move] 12-1 languages reordered with the keyboard alone, and an order change by itself is saved without a review", async () => {
		const shown = withSite(stories.Languages);
		await shown.run();
		(page.getByRole("button", { name: "English 옮기기" }).element() as HTMLElement).focus();
		await userEvent.keyboard(" ");
		await expect.poll(said).toContain("English");
		await userEvent.keyboard("{ArrowDown}");
		await userEvent.keyboard(" ");
		await expect.poll(languages).toEqual(["한국어", "日本語", "English"]);
		await userEvent.click(saveGroup());
		await expect.element(page.getByText("적용했습니다")).toBeVisible();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
		expect(codes(await settingsOf(shown.loaded()))).toEqual(["ko", "ja", "en"]);
	});

	it("[dragging] [dropped] a language held by its handle is under the pointer while the next one makes room; let go, it stays after it, and the source never moves", async () => {
		await Languages.run();
		const before = { source: topOf("한국어"), english: topOf("English"), japanese: topOf("日本語") };
		const from = middleOf(page.getByRole("button", { name: "English 옮기기" }).element());
		const down = before.japanese - before.english;
		await dragPath([from, { x: from.x, y: from.y + down }], { hold: true });
		// The row in hand follows the pointer; the one it passes moved up into its place; the source stays put.
		await expect.poll(() => topOf("English")).toBe(before.english + down);
		await expect.poll(() => topOf("日本語")).toBe(before.english);
		expect(topOf("한국어")).toBe(before.source);
		await dropDrag();
		await expect.poll(languages).toEqual(["한국어", "日本語", "English"]);
		// Dragged back to where it was saved, nothing is left to save.
		const again = middleOf(page.getByRole("button", { name: "English 옮기기" }).element());
		await dragPath([again, { x: again.x, y: again.y - down }]);
		await expect.poll(languages).toEqual(["한국어", "English", "日本語"]);
		await expect.element(saveGroup()).not.toBeInTheDocument();
	});

	it("12-3 [flow 11·16] on the live site the languages are read-only: a lock on every row, and nothing to move, take out, change or add", async () => {
		await LanguagesLive.run();
		expect(languages()).toEqual(["한국어", "English", "日本語"]);
		for (const name of ["English 옮기기", "English 빼기", "바꾸기", "+ 언어 추가"])
			await expect.element(page.getByRole("button", { name })).not.toBeInTheDocument();
		// The address mark of the site tab is the file's too: text with its lock, no select.
		await userEvent.click(tab(/사이트/));
		await expect.element(page.getByText("원문 언어만 빼고")).toBeVisible();
		await expect.element(page.getByRole("combobox", { name: "주소에 언어 표시" })).not.toBeInTheDocument();
		// What lives in the database is still an input.
		await expect.element(nameField()).toBeEnabled();
	});
});

describe("settings: a save that is refused", () => {
	it("12-4 when the schema file cannot be written, the reason stays at the top of the screen with 다시 저장: the name is saved, the structure change waits, and saving again finishes it", async () => {
		const files = {
			locked: true,
			async write() {
				if (this.locked) throw new Error("EACCES: permission denied, open 'monti.schema.ts'");
			},
			readChanges: async () => [],
		};
		const shown = withSite({ ...stories.SaveRefused, loaders: stories.settingsAt("site", { files }) });
		await shown.run();
		await expect.element(page.getByText("monti.schema.ts를 쓰지 못했습니다")).toBeVisible();
		// The admin value is saved and left the draft; the structure value is still a change to save.
		const partly = await settingsOf(shown.loaded());
		expect(partly.site.name).toBe("example.blog");
		expect(partly.schema.locales.prefix).toBe("exceptSource");
		await expect.poll(siteName).toBe("example.blog");
		await expect.element(page.getByRole("button", { name: /변경 사항/ })).toHaveTextContent("1");
		await expect.element(page.getByRole("combobox", { name: "주소에 언어 표시" })).toHaveTextContent("항상");
		// It does not go by itself: moving to another tab and back, the line is still there.
		await userEvent.click(tab(/언어/));
		await userEvent.click(tab(/사이트/));
		await expect.element(page.getByText("monti.schema.ts를 쓰지 못했습니다")).toBeVisible();

		files.locked = false;
		await userEvent.click(page.getByRole("button", { name: "다시 저장" }));
		await userEvent.click(page.getByRole("button", { name: "적용", exact: true }));
		await expect.element(page.getByText("적용했습니다")).toBeVisible();
		await expect.element(page.getByText("monti.schema.ts를 쓰지 못했습니다")).not.toBeInTheDocument();
		expect((await settingsOf(shown.loaded())).schema.locales.prefix).toBe("always");
	});

	it("12-4 a refusal's banner stays while the next save is on its way and goes with its answer: the page does not move up and down again", async () => {
		const server: { refuse: boolean; release: (() => void) | null } = { refuse: true, release: null };
		const shown = withSite({
			...stories.SiteChanged,
			render: (_args: unknown, { loaded }: { loaded: Loaded }) => (
				<MontiAdmin
					transport={async (name, input, options) => {
						if (name === "settings.save") {
							if (server.refuse) return { status: 500, body: { error: "unexpected" } };
							// The next save waits until the test lets it go.
							await new Promise<void>((release) => {
								server.release = release;
							});
						}
						return loaded.site.transport(name, input, options);
					}}
					siteName="example.dev"
				/>
			),
		});
		await shown.run();
		await userEvent.click(saveGroup());
		const banner = page.getByRole("status").filter({ hasText: "저장하지 못했습니다" });
		await expect.element(banner).toBeVisible();
		const title = () => Math.round(page.getByRole("heading", { name: "설정" }).element().getBoundingClientRect().top);
		const under = title();
		server.refuse = false;
		await userEvent.click(page.getByRole("button", { name: "다시 저장" }));
		await expect.poll(() => server.release !== null).toBe(true);
		// On its way: the banner is where it was, and so is the page under it.
		await expect.element(banner).toBeVisible();
		expect(title()).toBe(under);
		server.release?.();
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		await expect.element(banner).not.toBeInTheDocument();
		expect(title()).toBeLessThan(under);
	});

	it("12-2 a save over values changed elsewhere is refused at the top of the screen with 다시 불러오기: reading again keeps my change, and the next save goes", async () => {
		const shown = withSite(stories.SiteChanged);
		await shown.run();
		// Another tab saved the writing rules after this screen read them.
		await shown.loaded().site.monti.run("settings.save", { site: { writing: "다른 탭에서 고친 규칙" } }, admin);
		await userEvent.click(saveGroup());
		await expect.element(page.getByText("다른 곳에서 바뀌었습니다")).toBeVisible();
		expect((await settingsOf(shown.loaded())).site.name).toBe("example.dev");
		await userEvent.click(page.getByRole("button", { name: "다시 불러오기" }));
		await expect.element(page.getByText("다른 곳에서 바뀌었습니다")).not.toBeInTheDocument();
		await expect.element(page.getByRole("textbox", { name: "말투와 규칙" })).toHaveValue("다른 탭에서 고친 규칙");
		await expect.element(nameField()).toHaveValue("example.blog");
		await userEvent.click(saveGroup());
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		expect((await settingsOf(shown.loaded())).site).toMatchObject({
			name: "example.blog",
			writing: "다른 탭에서 고친 규칙",
		});
	});
});

describe("settings: a language problem can be seen and undone", () => {
	it("12-1 the source put back onto a language that was taken out: the review says what is to fix and opens the tab, where the struck source row has its undo", async () => {
		const shown = withSite(stories.SourceChanged);
		await shown.run();
		// English is the source; Korean is taken out; then the source line of the changes list is undone: Korean is the source again, struck.
		await userEvent.click(page.getByRole("button", { name: "한국어 빼기" }));
		await userEvent.click(page.getByRole("button", { name: /변경 사항/ }));
		await userEvent.click(page.getByRole("menuitem", { name: /원문 변경/ }).getByRole("button", { name: "되돌리기" }));
		await userEvent.keyboard("{Escape}");
		await expect.poll(languages).toEqual(["한국어", "English", "日本語"]);
		// The save is not offered as if nothing were wrong: the review names the problem, with no pill to apply.
		await userEvent.click(saveGroup());
		const sheet = page.getByRole("dialog");
		await expect.element(sheet.getByText("원문 언어가 목록에 없습니다")).toBeVisible();
		await expect.element(page.getByRole("button", { name: "지우고 적용" })).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "적용", exact: true })).not.toBeInTheDocument();
		// Its line goes to the language tab, where the source row itself takes the removal back.
		await userEvent.click(sheet.getByRole("button", { name: "열기" }));
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("list", { name: "콘텐츠 언어" }).getByRole("button", { name: "되돌리기" }));
		await expect.element(page.getByRole("button", { name: "바꾸기" })).toBeVisible();
		await expect.element(saveGroup()).not.toBeInTheDocument();
		expect(codes(await settingsOf(shown.loaded()))).toEqual(["ko", "en", "ja"]);
	});
});

describe("settings › collections inside the one draft", () => {
	it("12-2 a renamed field keeps the width its column was dragged to", async () => {
		const shown = withSite({
			loaders: stories.settingsAt("collections", {
				more: async ({ monti }) => {
					await monti.run(
						"list.savePrefs",
						{ collection: "post", widths: { summary: 240 }, hidden: ["summary"] },
						admin,
					);
				},
			}),
		});
		await shown.run();
		await userEvent.click(page.getByRole("button", { name: "summary 열기" }));
		const sheet = page.getByRole("dialog");
		await userEvent.fill(sheet.getByLabelText(/^식별자/), "excerpt");
		await userEvent.click(sheet.getByRole("button", { name: "저장" }));
		await expect.element(page.getByRole("button", { name: "excerpt 열기" })).toBeVisible();
		await userEvent.click(saveGroup());
		await userEvent.click(page.getByRole("button", { name: "적용", exact: true }));
		await expect.element(page.getByText("적용했습니다")).toBeVisible();
		const read = (await shown.loaded().site.monti.run("schema.read", {}, admin)) as {
			adminValues: Record<string, { list?: { widths?: Record<string, number>; hidden?: string[] } }>;
		};
		expect(read.adminValues.post?.list).toEqual({ widths: { excerpt: 240 }, hidden: ["excerpt"] });
	});

	it("12-2 a collection name longer than the database keeps is told in the sheet, before it is made", async () => {
		const shown = withSite({ loaders: stories.settingsAt("collections") });
		await shown.run();
		await userEvent.click(page.getByRole("button", { name: "+ 새 컬렉션" }));
		const sheet = page.getByRole("dialog");
		await userEvent.fill(sheet.getByLabelText(/^식별자/), `a${"b".repeat(57)}`);
		await expect.element(sheet.getByText("이름이 너무 깁니다")).toBeVisible();
		await userEvent.fill(sheet.getByLabelText(/^식별자/), `a${"b".repeat(56)}`);
		await expect.element(sheet.getByText("이름이 너무 깁니다")).not.toBeInTheDocument();
	});

	it("12-2 a collection's first admin values are saved on the version the screen read: values another tab saved meanwhile are a conflict, not written over", async () => {
		const shown = withSite({
			loaders: stories.settingsAt("collections", {
				// The memos have no admin values yet.
				more: async ({ db }) => {
					await db.deleteFrom("collection_admin_values").where("collection", "=", "memo").execute();
				},
			}),
		});
		await shown.run();
		await userEvent.click(page.getByRole("navigation", { name: "컬렉션" }).getByRole("button", { name: /memo/ }));
		await userEvent.click(page.getByRole("button", { name: "기본", exact: true }));
		await userEvent.fill(page.getByRole("textbox", { name: "표시 이름" }), "메모");
		// Another tab turned folders on for the memos after this screen read them.
		const { monti, db } = shown.loaded().site;
		await monti.run("collections.updateAdminValues", { collection: "memo", values: { folders: true } }, admin);
		await userEvent.click(saveGroup());
		await expect.element(page.getByText("다른 곳에서 바뀌었습니다")).toBeVisible();
		const row = await db
			.selectFrom("collection_admin_values")
			.select("values")
			.where("collection", "=", "memo")
			.executeTakeFirstOrThrow();
		expect(row.values).toEqual({ folders: true });
		// Read again, both are there to save: the other tab's folders and my name.
		await userEvent.click(page.getByRole("button", { name: "다시 불러오기" }));
		await expect.element(page.getByRole("switch", { name: "폴더 사용" })).toBeChecked();
		await userEvent.click(saveGroup());
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		const after = await db
			.selectFrom("collection_admin_values")
			.select("values")
			.where("collection", "=", "memo")
			.executeTakeFirstOrThrow();
		expect(after.values).toEqual({ label: "메모", folders: true });
	});

	it("12-1 [flow 4·10] the undo of one line of the changes list puts back every place of it: a field's rename and its new label together", async () => {
		const shown = withSite({ loaders: stories.settingsAt("collections") });
		await shown.run();
		await userEvent.click(page.getByRole("button", { name: "summary 열기" }));
		const sheet = page.getByRole("dialog");
		await userEvent.fill(sheet.getByLabelText(/^식별자/), "excerpt");
		await userEvent.fill(sheet.getByLabelText("표시 이름"), "발췌");
		await userEvent.click(sheet.getByRole("button", { name: "저장" }));
		await expect.element(page.getByRole("button", { name: "excerpt 열기" })).toBeVisible();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
		// One line for the field, holding both places.
		await userEvent.click(page.getByRole("button", { name: /변경 사항/ }));
		const line = page.getByRole("menuitem", { name: /발췌/ });
		await userEvent.click(line.getByRole("button", { name: "되돌리기" }));
		await expect.element(page.getByRole("button", { name: "summary 열기" })).toBeVisible();
		await expect.element(page.getByRole("button", { name: "excerpt 열기" })).not.toBeInTheDocument();
		// Nothing is left of it: the label is the saved one, and there is no change to save.
		await expect.element(page.getByText("요약")).toBeVisible();
		await expect.element(page.getByText("발췌")).not.toBeInTheDocument();
		await expect.element(saveGroup()).not.toBeInTheDocument();
	});

	it("12-1 a new language moved above the saved ones is saved where it was put", async () => {
		const shown = withSite(stories.LanguageAdded);
		await shown.run();
		(page.getByRole("button", { name: "Deutsch 옮기기" }).element() as HTMLElement).focus();
		await userEvent.keyboard(" ");
		await expect.poll(said).toContain("Deutsch");
		await userEvent.keyboard("{ArrowUp}");
		await expect.poll(said).toContain("日本語");
		await userEvent.keyboard("{ArrowUp}");
		await expect.poll(said).toContain("English");
		await userEvent.keyboard(" ");
		await expect.poll(languages).toEqual(["한국어", "Deutsch", "English", "日本語"]);
		await userEvent.click(saveGroup());
		await userEvent.click(page.getByRole("button", { name: "적용", exact: true }));
		await expect.element(page.getByText("적용했습니다")).toBeVisible();
		expect(codes(await settingsOf(shown.loaded()))).toEqual(["ko", "de", "en", "ja"]);
	});

	it("12-1 a language added, moved and then taken back from the changes list leaves no change: its row and the order it changed go together", async () => {
		await LanguageAdded.run();
		// Deutsch moved above English, then its line of the changes list undone.
		(page.getByRole("button", { name: "Deutsch 옮기기" }).element() as HTMLElement).focus();
		await userEvent.keyboard(" ");
		await expect.poll(said).toContain("Deutsch");
		await userEvent.keyboard("{ArrowUp}");
		await expect.poll(said).toContain("日本語");
		await userEvent.keyboard("{ArrowUp}");
		await expect.poll(said).toContain("English");
		await userEvent.keyboard(" ");
		await expect.poll(languages).toEqual(["한국어", "Deutsch", "English", "日本語"]);
		await userEvent.click(page.getByRole("button", { name: /변경 사항/ }));
		await userEvent.click(page.getByRole("menuitem", { name: /Deutsch/ }).getByRole("button", { name: "되돌리기" }));
		await expect.poll(languages).toEqual(["한국어", "English", "日本語"]);
		await expect.element(saveGroup()).not.toBeInTheDocument();
	});
});

describe("settings: the assistant's proposals", () => {
	it("12-1 [flow 2·21] a proposed value is drawn in its field with the saved one struck under it; its label's 버리기 throws the proposal away", async () => {
		await SiteProposal.run();
		await expect.element(nameField()).toHaveValue("example.blog");
		await expect.element(nameField()).toHaveAttribute("data-proposal");
		await expect.element(page.getByRole("deletion").filter({ hasText: "example.dev" })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "버리기", exact: true }).first());
		await expect.element(nameField()).toHaveValue("example.dev");
		await expect.element(nameField()).not.toHaveAttribute("data-proposal");
		await expect.element(page.getByRole("button", { name: "모두 받기" })).not.toBeInTheDocument();
	});

	it("12-1 typing in a proposed field takes the proposal first: it becomes my unsaved change, and nothing is saved until the save", async () => {
		const shown = withSite(stories.SiteProposal);
		await shown.run();
		await userEvent.type(nameField(), "!");
		await expect.element(nameField()).toHaveValue("example.blog!");
		await expect.element(nameField()).not.toHaveAttribute("data-proposal");
		await expect.element(page.getByRole("button", { name: "모두 받기" })).not.toBeInTheDocument();
		expect((await settingsOf(shown.loaded())).site.name).toBe("example.dev");
		// The proposal's other value was taken with it: the save now sends the address mark too, through the review.
		await userEvent.click(saveGroup());
		await userEvent.click(page.getByRole("button", { name: "적용", exact: true }));
		await expect.element(page.getByText("적용했습니다")).toBeVisible();
		const settings = await settingsOf(shown.loaded());
		expect(settings.site.name).toBe("example.blog!");
		expect(settings.schema.locales.prefix).toBe("always");
	});

	it("12-2 a proposal taken and then put back in part is saved with the part that is kept: the name undone, the address mark applied", async () => {
		// The proposal alone, with no change of my own beside it: after the name is put back, the save holds the address mark only.
		const shown = withSite({ loaders: stories.SiteProposal.loaders });
		await shown.run();
		await userEvent.click(page.getByRole("button", { name: "모두 받기" }));
		// Taken, the proposal's two values are my changes; the name's own undo puts only the name back.
		await expect.element(nameField()).toHaveValue("example.blog");
		await userEvent.click(page.getByRole("button", { name: "되돌리기", exact: true }).first());
		await expect.element(nameField()).toHaveValue("example.dev");
		await expect.element(page.getByRole("button", { name: /변경 사항/ })).toHaveTextContent("1");
		await userEvent.click(saveGroup());
		await userEvent.click(page.getByRole("button", { name: "적용", exact: true }));
		await expect.element(page.getByText("적용했습니다")).toBeVisible();
		const settings = await settingsOf(shown.loaded());
		expect(settings.site.name).toBe("example.dev");
		expect(settings.schema.locales.prefix).toBe("always");
		// The item went with the save: nothing of it waits any more.
		const pending = await shown
			.loaded()
			.site.monti.run(
				"proposals.forTarget",
				{ kind: "settings", id: "site", also: [{ kind: "schema", id: "current" }] },
				admin,
			);
		expect(pending).toEqual([]);
	});

	it("12-1 a proposal of a collection's admin values alone shows on the settings: the tab's blue dot, the name blue on the basics, and the bubble takes it", async () => {
		const shown = withSite(stories.CollectionValuesProposal);
		await shown.run();
		const name = page.getByRole("textbox", { name: "표시 이름" });
		await expect.element(name).toHaveValue("글");
		await expect.element(name).toHaveAttribute("data-proposal");
		await expect.element(page.getByRole("deletion").filter({ hasText: "게시글" })).toBeVisible();
		// From another tab, the collections tab says it holds a proposal.
		await userEvent.click(tab(/사이트/));
		await expect.element(tab(/컬렉션/).getByRole("img", { name: "제안" })).toBeVisible();
		// Back on the collections tab it is where it was drawn.
		await userEvent.click(tab(/컬렉션/));
		await expect.element(page.getByRole("textbox", { name: "표시 이름" })).toHaveValue("글");
		await userEvent.click(page.getByRole("button", { name: "모두 받기" }));
		await expect.element(page.getByRole("textbox", { name: "표시 이름" })).not.toHaveAttribute("data-proposal");
		await userEvent.click(saveGroup());
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		const read = (await shown.loaded().site.monti.run("schema.read", {}, admin)) as {
			adminValues: Record<string, { label?: string; folders?: boolean }>;
		};
		// The name is saved, and the rest of the collection's values are as they were.
		expect(read.adminValues.post).toMatchObject({ label: "글", folders: true });
	});

	it("12-2 a proposal that names a label alone proposes the label alone: nothing else of the collection is drawn as proposed, and taking it clears nothing", async () => {
		const shown = withSite(stories.CollectionValuesProposal);
		await shown.run();
		const before = (await shown.loaded().site.monti.run("schema.read", {}, admin)) as {
			adminValues: Record<string, Record<string, unknown>>;
		};
		// On the basics the name is the one blue thing: the folders switch is as saved, with no proposal mark.
		await expect.element(page.getByRole("textbox", { name: "표시 이름" })).toHaveAttribute("data-proposal");
		await expect.element(page.getByRole("switch", { name: "폴더 사용" })).toBeChecked();
		// One proposal mark on the page: the name's own, on its label row.
		await expect.poll(() => page.getByRole("img", { name: "제안" }).elements().length).toBe(1);
		// No field's line is the assistant's.
		await userEvent.click(page.getByRole("button", { name: /^필드/ }));
		await expect.element(page.getByRole("button", { name: "summary 열기" })).toBeVisible();
		await expect.element(page.getByText("✦ 제안")).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "모두 받기" }));
		await userEvent.click(saveGroup());
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		const after = (await shown.loaded().site.monti.run("schema.read", {}, admin)) as {
			adminValues: Record<string, Record<string, unknown>>;
		};
		const { version: _before, ...saved } = before.adminValues.post as { version: number };
		const { version: _after, ...now } = after.adminValues.post as { version: number };
		// Every field's label and help, the folders and the rest are what they were: only the name moved.
		expect(now).toEqual({ ...saved, label: "글" });
	});

	it("12-1 a settings.save proposal that gives a site name and a collection's name draws both, without a structure change beside", async () => {
		const shown = withSite({
			...stories.Site,
			loaders: stories.settingsAt("site", {
				more: async ({ monti }) => {
					const proposal = await monti.proposals.create("conversation-1", "이름을 정리해 줘");
					await monti.proposals.add(proposal, "settings.save", {
						site: { name: "example.blog" },
						adminValues: { post: { label: "글" } },
					});
				},
			}),
		});
		await shown.run();
		await expect.element(nameField()).toHaveValue("example.blog");
		await expect.element(nameField()).toHaveAttribute("data-proposal");
		await userEvent.click(tab(/컬렉션/));
		await userEvent.click(page.getByRole("button", { name: "기본", exact: true }));
		await expect.element(page.getByRole("textbox", { name: "표시 이름" })).toHaveValue("글");
		await expect.element(page.getByRole("textbox", { name: "표시 이름" })).toHaveAttribute("data-proposal");
	});

	it("12-4 a taken proposal whose save could write nothing stays the assistant's: after 모두 되돌리기 it is there to take again", async () => {
		const files = {
			async write() {
				throw new Error("EACCES: permission denied, open 'monti.schema.ts'");
			},
			readChanges: async () => [],
		};
		const shown = withSite({
			...stories.LanguageProposal,
			loaders: stories.settingsAt("languages", {
				files,
				more: async ({ monti }) => {
					const proposal = await monti.proposals.create("conversation-1", "독일어도 추가해 줘");
					await monti.proposals.add(proposal, "locales.apply", {
						locales: { source: "ko", prefix: "exceptSource", list: [...LANGUAGES, { code: "de", name: "Deutsch" }] },
						answers: {},
					});
				},
			}),
		});
		await shown.run();
		await userEvent.click(page.getByRole("button", { name: "모두 받기" }));
		await userEvent.click(saveGroup());
		await userEvent.click(page.getByRole("button", { name: "적용", exact: true }));
		// Refused where the person acts: the review says why, and nothing was saved.
		await expect.element(page.getByText("monti.schema.ts를 쓰지 못했습니다.")).toBeVisible();
		const { db, monti } = shown.loaded().site;
		// The one save in the log is the story's own (the site's name, when the site was set up): the refused save left no row.
		const saves = await db.selectFrom("monti_activity").select("id").where("operation", "=", "settings.save").execute();
		expect(saves).toHaveLength(1);
		await userEvent.click(page.getByRole("button", { name: "취소" }));
		await userEvent.click(page.getByRole("button", { name: "모두 되돌리기" }));
		// The proposal was not used up by the save that failed: it is pending, and the bubble offers it again.
		await expect.element(page.getByRole("button", { name: "모두 받기" })).toBeVisible();
		expect(languages()).toEqual(["한국어", "English", "日本語", "Deutsch"]);
		const pending = (await monti.run("proposals.forTarget", { kind: "schema", id: "current" }, admin)) as unknown[];
		expect(pending).toHaveLength(1);
	});

	it("12-2 a taken value typed back to the saved one is put back: the next save sends no item it saves nothing of, and goes through", async () => {
		const shown = withSite({
			loaders: stories.settingsAt("site", {
				more: async ({ monti }) => {
					const proposal = await monti.proposals.create("conversation-1", "사이트 이름을 블로그답게");
					await monti.proposals.add(proposal, "settings.save", { site: { name: "example.blog" } });
				},
			}),
		});
		await shown.run();
		await userEvent.click(page.getByRole("button", { name: "모두 받기" }));
		await expect.element(nameField()).not.toHaveAttribute("data-proposal");
		// The old name typed back, by hand, not with the undo.
		await userEvent.fill(nameField(), "example.dev");
		// Another change, of a collection: the save holds nothing of the proposal.
		await userEvent.click(tab(/컬렉션/));
		await userEvent.click(page.getByRole("button", { name: "기본", exact: true }));
		await userEvent.fill(page.getByRole("textbox", { name: "표시 이름" }), "글");
		await userEvent.click(saveGroup());
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		const { monti } = shown.loaded().site;
		expect((await settingsOf(shown.loaded())).site.name).toBe("example.dev");
		// Not taken any more, the proposal waits as it did before.
		const pending = (await monti.run("proposals.forTarget", { kind: "settings", id: "site" }, admin)) as unknown[];
		expect(pending).toHaveLength(1);
		await userEvent.click(tab(/사이트/));
		await expect.element(nameField()).toHaveAttribute("data-proposal");
	});

	it("12-1 a proposed language is a row of the language tab until it is taken; from another tab the language tab carries the blue dot", async () => {
		await LanguageProposal.run();
		expect(languages()).toEqual(["한국어", "English", "日本語", "Deutsch"]);
		await expect.element(saveGroup()).not.toBeInTheDocument();
		await userEvent.click(tab(/관리자/));
		await expect.element(tab(/언어/).getByRole("img", { name: "제안" })).toBeVisible();
		await userEvent.click(tab(/언어/));
		await userEvent.click(page.getByRole("button", { name: "모두 받기" }));
		await expect.element(saveGroup()).toBeVisible();
		await expect.element(page.getByRole("button", { name: "모두 받기" })).not.toBeInTheDocument();
	});
});

describe("settings › admin", () => {
	it("12-2 the screen language is saved the moment it is picked: every word follows at once, with no save group", async () => {
		const shown = withSite(stories.Admin);
		await shown.run();
		await userEvent.click(page.getByRole("combobox", { name: "화면 언어" }));
		await userEvent.click(page.getByRole("option", { name: /English/ }));
		await expect.element(page.getByRole("button", { name: "Sign out" })).toBeVisible();
		await expect.element(page.getByRole("button", { name: "Trash" })).toBeVisible();
		await expect.element(page.getByRole("button", { name: /^Save/ })).not.toBeInTheDocument();
		expect((await settingsOf(shown.loaded())).admin.language).toBe("en");
	});

	it("12-2 body templates turned off are offered nowhere: not in the tools, not in the new-entry menu; turned on, they are back", async () => {
		const shown = withSite({
			...stories.Admin,
			loaders: stories.settingsAt("admin", {
				more: async ({ monti }) => {
					await monti.run("templates.save", { name: "회고", doc: { type: "doc", blocks: [] } }, admin);
				},
			}),
		});
		await shown.run();
		const templates = page.getByRole("switch", { name: "본문 템플릿" });
		await expect.element(templates).toBeChecked();
		await userEvent.click(templates);
		await expect.element(templates).not.toBeChecked();
		expect((await settingsOf(shown.loaded())).admin.templates).toBe(false);
		await userEvent.click(page.getByRole("button", { name: "도구" }));
		await expect.element(page.getByRole("heading", { name: "도구" })).toBeVisible();
		await expect.element(page.getByRole("button", { name: "템플릿 추가" })).not.toBeInTheDocument();
		await expect.element(page.getByText("회고")).not.toBeInTheDocument();
		// The memos have no folders, so with no template to offer their new-entry pill has no menu at all.
		await userEvent.click(page.getByRole("button", { name: /메모/ }));
		await expect.element(page.getByRole("button", { name: "+ 새 메모" })).toBeVisible();
		await expect.element(page.getByRole("button", { name: MORE_NEW })).not.toBeInTheDocument();

		await userEvent.click(page.getByRole("button", { name: "설정" }));
		await userEvent.click(tab(/관리자/));
		await userEvent.click(page.getByRole("switch", { name: "본문 템플릿" }));
		await userEvent.click(page.getByRole("button", { name: "도구" }));
		await expect.element(page.getByText("회고")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: /메모/ }));
		await userEvent.click(page.getByRole("button", { name: MORE_NEW }));
		await expect.element(page.getByRole("menuitem", { name: "템플릿으로 쓰기" })).toBeVisible();
	});

	it("12-2 a preference that could not be saved says so under its control and stays: the switch is as saved, and the next pick that goes through clears it", async () => {
		const refusing = { on: true };
		const shown = withSite({
			...stories.Admin,
			render: (_args: unknown, { loaded }: { loaded: Loaded }) => (
				<MontiAdmin
					transport={(name, input, options) =>
						name === "admin.setPreference" && refusing.on
							? Promise.resolve({ status: 500, body: { error: "unexpected" } })
							: loaded.site.transport(name, input, options)
					}
					siteName="example.dev"
				/>
			),
		});
		await shown.run();
		const templates = page.getByRole("switch", { name: "본문 템플릿" });
		await userEvent.click(templates);
		// Not saved: the reason is beside the switch, which still shows what is saved.
		await expect.element(page.getByRole("alert").filter({ hasText: "저장하지 못했습니다" })).toBeVisible();
		await expect.element(templates).toBeChecked();
		expect((await settingsOf(shown.loaded())).admin.templates).toBe(true);
		// It does not leave by itself, as a toast would.
		await new Promise((done) => setTimeout(done, 6000));
		await expect.element(page.getByText("저장하지 못했습니다")).toBeVisible();
		// Nor with a look at another tab: nothing was picked again, so the refusal still stands on the way back.
		await userEvent.click(tab(/사이트/));
		await expect.element(page.getByLabelText("사이트 이름")).toBeVisible();
		await expect.element(page.getByText("저장하지 못했습니다")).not.toBeInTheDocument();
		await userEvent.click(tab(/관리자/));
		await expect.element(page.getByRole("alert").filter({ hasText: "저장하지 못했습니다" })).toBeVisible();
		await expect.element(templates).toBeChecked();
		refusing.on = false;
		await userEvent.click(templates);
		await expect.element(templates).not.toBeChecked();
		await expect.element(page.getByText("저장하지 못했습니다")).not.toBeInTheDocument();
	});

	it("12-1 the save pill is not greyed while the save is on its way: it says it is saving, at full strength", async () => {
		const held: { release?: () => void } = {};
		const shown = withSite({
			...stories.SiteChanged,
			render: (_args: unknown, { loaded }: { loaded: Loaded }) => (
				<MontiAdmin
					transport={async (name, input, options) => {
						// The save waits until the test lets it go.
						if (name === "settings.save")
							await new Promise<void>((release) => {
								held.release = release;
							});
						return loaded.site.transport(name, input, options);
					}}
					siteName="example.dev"
				/>
			),
		});
		await shown.run();
		await userEvent.click(saveGroup());
		const saving = page.getByRole("button", { name: "저장 중…" });
		await expect.element(saving).toBeVisible();
		await expect.element(saving).toHaveAttribute("aria-busy", "true");
		// Drawn at full strength, not faded as a control that cannot be used is.
		expect(getComputedStyle(saving.element()).opacity).toBe("1");
		// The pill that was pressed still has the focus: it did not fall to the page.
		expect(document.activeElement).toBe(saving.element());
		held.release?.();
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
	});

	it("12-1 a session let in without signing in (the dev server's, doc 16) has no account: the account section is not drawn, and the rest of the tab stands", async () => {
		await withSite(stories.AdminDevBypass).run();
		await expect.element(page.getByRole("switch", { name: "본문 템플릿" })).toBeVisible();
		await expect.element(page.getByRole("combobox", { name: "화면 언어" })).toBeVisible();
		// Nobody signed in: no account to name and no way out to offer ("dev" and a sign-out that lets the person straight back in tell nothing).
		await expect.element(page.getByRole("heading", { name: "계정" })).not.toBeInTheDocument();
		await expect.element(page.getByText("로그인한 계정")).not.toBeInTheDocument();
		await expect.element(page.getByText("dev", { exact: true })).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "로그아웃" })).not.toBeInTheDocument();
		// A person who signed in has the section.
		await withSite(stories.Admin).run();
		await expect.element(page.getByRole("heading", { name: "계정" })).toBeVisible();
		await expect.element(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
	});

	it("12-1 the sidebar and the sign-in screen show the site name the settings hold, and 로그아웃 ends the session without asking", async () => {
		const shown = withSite({
			...stories.Admin,
			loaders: stories.settingsAt("admin", {
				more: async ({ monti }) => {
					await monti.run("settings.save", { site: { name: "저장한 이름" } }, admin);
				},
			}),
		});
		await shown.run();
		await expect.poll(siteName).toBe("저장한 이름");
		await expect.element(page.getByText("me@example.dev")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "로그아웃" }));
		await expect.element(page.getByRole("button", { name: "로그인", exact: true })).toBeVisible();
		await expect.element(page.getByText("저장한 이름")).toBeVisible();
		await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
	});
});
