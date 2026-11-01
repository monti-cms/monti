import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { SchemaEditPreview, SchemaScreenState } from "../../../api/schema";
import { commonMessages } from "../../../lib/common.messages";
import { type FakeApi, fakeApi } from "../../../test/fake-api";
import { createTestRouter } from "../../../test/router";
import { schemaChangesMessages } from "../../schema/changes.messages";
import { schemaLocalesMessages } from "../../schema/locales.messages";
import { schemaMessages } from "../../schema/messages";
import { SchemaSettings } from "../../schema/schema-screen";
import { schemaSiteMessages } from "../../schema/site.messages";
import { AdminQueryProvider } from "../../shared/query-provider";

// Flow 11 of the canvas, the dev-server rows "사이트" (steps 01-04) and "언어" (steps 05-08): one walk through each checks what a screenshot cannot see: the
// requests a press sends, focus, names, what is enabled and the order of things. How it looks is the visual stories' job. The review of a removed language
// (step 08's sheet) belongs to the schema review; here the walk stops at the request the review sends.

const nav = createTestRouter();
const { render } = nav;
const t = testSite.createTranslator(schemaMessages);
const tSite = testSite.createTranslator(schemaSiteMessages);
const tLocales = testSite.createTranslator(schemaLocalesMessages);
const tChanges = testSite.createTranslator(schemaChangesMessages);
const tc = testSite.createTranslator(commonMessages);

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const story = {
	label: "Story",
	kind: "document",
	path: "/posts/:slug",
	fields: { title: { kind: "text", label: "Title", required: true } },
};

const state: SchemaScreenState = {
	access: { writable: true },
	file: "monti.schema.ts",
	hash: "hash-1",
	schema: {
		collections: { story },
		locales: [
			{ code: "de", name: "Deutsch" },
			{ code: "en", name: "English", label: "영어" },
		],
		defaultLocale: "de",
		timeZone: "Asia/Seoul",
		site: {
			name: "example.dev",
			aliases: ["www.example.dev"],
			previewPath: "/preview",
			previewLocaleParam: false,
			localePrefix: "always",
		},
	},
	source: "file",
	comments: false,
	issues: [],
	applied: { appliedAt: "2026-01-01T00:00:00.000Z" },
	codeCollections: [],
	vocabulary: { blocks: [], marks: [] },
	collections: ["story"],
	footprints: { story: { entries: 3, trashed: 0, folders: 0 } },
	siteUrl: { url: null, from: "none" },
};

/** The review of the draft: it checks and would change something, with nothing the stored entries care about. */
const preview: SchemaEditPreview = {
	valid: true,
	issues: [],
	changed: true,
	impacts: [],
	decisions: [],
	transforms: [],
	problems: [],
	baseline: "applied",
	bodiesRead: 0,
};

let api: FakeApi;

beforeEach(() => {
	vi.clearAllMocks();
	window.sessionStorage.clear();
	window.history.replaceState(null, "", "/admin/settings/site");
	api = fakeApi()
		.on("GET /v1/schema", () => state)
		.on("POST /v1/schema/preview", () => preview)
		.install();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const open = (tab: "site" | "locales", onChanged?: (areas: unknown) => void) =>
	render(
		<AdminQueryProvider>
			<SchemaSettings tab={tab} onChanged={onChanged as never} />
			<a href="/admin/posts">Posts</a>
		</AdminQueryProvider>,
	);

const field = (name: string) => screen.findByRole("textbox", { name });
const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
const bar = () => screen.getByRole("region", { name: t("bar.label") });
const changes = (count: number) => within(bar()).getByLabelText(t("bar.count", { count }));
const lastPreview = () => api.sent("POST /v1/schema/preview").at(-1);
/** Presses the save button of the title row and waits for the review to ask what the draft would do. */
const save = async () => {
	fireEvent.click(within(bar()).getByRole("button", { name: t("bar.save") }));
	await waitFor(() => expect(lastPreview()?.path).toBe("/v1/schema/preview"));
	return lastPreview()?.body.schema as {
		locales: { code: string; name: string; label?: string }[];
		defaultLocale: string;
		site: Record<string, unknown>;
	};
};
const saveButton = () => within(bar()).getByRole("button", { name: t("bar.save") }) as HTMLButtonElement;
/** Whether `name` is the name of a host row: the row label with any number in it. */
const isHostRow = (name: string) => {
	const [before = "", after = ""] = tSite("site.alias.row", { number: "\u0000" }).split("\u0000");
	const number = name.slice(before.length, name.length - after.length);
	return name.startsWith(before) && name.endsWith(after) && /^\d+$/.test(number);
};

describe("flow 11 · 개발 서버 · 사이트: the site settings of the file", () => {
	it("SET-S1 01 + 호스트 adds an empty row with the caret in it, typing writes site.aliases, and × takes a host out", async () => {
		const onChanged = vi.fn();
		open("site", onChanged);

		// The saved host is a row of its own, in mono, with a × named after it.
		const saved = await field(tSite("site.alias.row", { number: 1 }));
		expect((saved as HTMLInputElement).value).toBe("www.example.dev");
		expect(
			screen.getByRole("button", { name: tSite("site.alias.remove", { name: "www.example.dev" }) }),
		).toBeInTheDocument();
		expect(screen.queryByRole("region", { name: t("bar.label") })).toBeNull();

		const boxes = screen.getAllByRole("textbox").length;
		// "+ 호스트": an empty row appears under it with the caret in it. An empty row is no change: nothing is listed and nothing would be written.
		fireEvent.click(screen.getByRole("button", { name: tSite("site.alias.add") }));
		const added = screen.getByRole("textbox", { name: tSite("site.alias.row", { number: 2 }) }) as HTMLInputElement;
		expect(added.value).toBe("");
		expect(added.placeholder).toBe("blog.example.dev");
		expect(document.activeElement).toBe(added);
		expect(screen.queryByRole("region", { name: t("bar.label") })).toBeNull();
		// There is no separate input for a new host and no Add button: the one way to add is the row that just came.
		expect(screen.getAllByRole("textbox")).toHaveLength(boxes + 1);
		expect(screen.getAllByRole("textbox", { name: isHostRow })).toHaveLength(2);
		expect(screen.getAllByRole("button", { name: (name) => name.startsWith(tSite("site.alias.add")) })).toHaveLength(1);

		// Typing the host is one change: the title row's group says 1, the Site tab is marked, and the field's label row carries the dot and the undo.
		type(added, "blog.example.dev");
		expect(changes(1)).toBeInTheDocument();
		expect(onChanged).toHaveBeenLastCalledWith(
			expect.objectContaining({ tabs: expect.objectContaining({ site: true }) }),
		);
		expect(
			screen.getByRole("button", { name: t("revert.named", { name: tSite("site.aliases") }) }),
		).toBeInTheDocument();

		// The request the review sends has the host in site.aliases, after the saved one.
		const schema = await save();
		expect(schema.site.aliases).toEqual(["www.example.dev", "blog.example.dev"]);
	});

	it("SET-S1 02 turning off 'language in the preview path' shows the query field (empty means locale); turning it on hides it", async () => {
		open("site");
		const name = tSite("site.previewInPath");
		const toggle = await screen.findByRole("switch", { name });
		expect(toggle.getAttribute("aria-checked")).toBe("true");
		expect(screen.queryByRole("textbox", { name: tSite("site.previewParam") })).toBeNull();

		fireEvent.click(toggle);
		const query = (await field(tSite("site.previewParam"))) as HTMLInputElement;
		expect(query.value).toBe("");
		expect(query.placeholder).toBe("locale");
		expect(changes(1)).toBeInTheDocument();
		// The switch carries the change dot; the query field is the same setting and does not repeat it.
		expect(screen.getAllByRole("img", { name: t("changed") })).toHaveLength(1);

		// Turned on again, the field goes and nothing is changed any more.
		fireEvent.click(screen.getByRole("switch", { name }));
		await waitFor(() => expect(screen.queryByRole("textbox", { name: tSite("site.previewParam") })).toBeNull());
		expect(screen.queryByRole("region", { name: t("bar.label") })).toBeNull();

		// A query typed in is the value saved.
		fireEvent.click(screen.getByRole("switch", { name }));
		type(await field(tSite("site.previewParam")), "lang");
		expect((await save()).site.previewLocaleParam).toBe("lang");
	});

	it("SET-S2 03 a host that is not a host name shows one error line under its row and blocks saving until it is fixed", async () => {
		open("site");
		const host = (await field(tSite("site.alias.row", { number: 1 }))) as HTMLInputElement;
		expect(host.getAttribute("aria-invalid")).toBeNull();

		type(host, "example dev");
		expect(host.getAttribute("aria-invalid")).toBe("true");
		expect(host).toHaveAccessibleDescription(tSite("problem.host"));
		expect(screen.getAllByText(tSite("problem.host"))).toHaveLength(1);
		// The group stays (the change is real) but the save button is off.
		expect(changes(1)).toBeInTheDocument();
		expect(saveButton().disabled).toBe(true);

		// The label row's undo puts the saved host back: the error goes with it.
		fireEvent.click(screen.getByRole("button", { name: t("revert.named", { name: tSite("site.aliases") }) }));
		// The rows follow the revert, so the input is a new one.
		const back = (await field(tSite("site.alias.row", { number: 1 }))) as HTMLInputElement;
		expect(back.value).toBe("www.example.dev");
		expect(back.getAttribute("aria-invalid")).toBeNull();
		expect(screen.queryByText(tSite("problem.host"))).toBeNull();

		// A new empty row is no problem; a host name typed into it is fine; a bad one blocks again.
		fireEvent.click(screen.getByRole("button", { name: tSite("site.alias.add") }));
		const added = screen.getByRole("textbox", { name: tSite("site.alias.row", { number: 2 }) });
		expect(added.getAttribute("aria-invalid")).toBeNull();
		type(added, "blog.example.dev");
		expect(added.getAttribute("aria-invalid")).toBeNull();
		expect(saveButton().disabled).toBe(false);
		type(added, "not a host");
		expect(added.getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByText(tSite("problem.host"))).toBeInTheDocument();
		expect(saveButton().disabled).toBe(true);
		type(added, "blog.example.dev");
		expect(saveButton().disabled).toBe(false);
	});

	it("WRITE-S6 04 a link clicked with unsaved changes asks first: keep editing stays, leaving without saving goes on", async () => {
		// Only the clicks that reach the window from the link itself are counted (the dialog's own buttons click too).
		const clicks = vi.fn((event: MouseEvent) => event.preventDefault());
		const onWindowClick = (event: MouseEvent) => {
			if ((event.target as Element).closest("a[href]")) clicks(event);
		};
		window.addEventListener("click", onWindowClick);
		open("site");

		// Nothing changed: the link goes at once.
		const link = screen.getByRole("link", { name: "Posts" });
		fireEvent.click(link);
		expect(clicks).toHaveBeenCalledTimes(1);
		clicks.mockClear();

		type(await field(tSite("site.name")), "example.dev/2");
		type(screen.getByRole("textbox", { name: tSite("site.previewPath") }), "draft");
		fireEvent.click(link);
		const dialog = await screen.findByRole("alertdialog", { name: tc("leave.title") });
		expect(dialog.textContent).toContain(tc("leave.description", { count: 2 }));
		// Two ways out, no "save and leave".
		const buttons = within(dialog)
			.getAllByRole("button")
			.map((button) => button.textContent);
		expect(buttons.sort()).toEqual([tc("leave.confirm"), tc("leave.stay")].sort());
		expect(clicks).not.toHaveBeenCalled();

		// 계속 고치기: the dialog goes, the page stays, the draft is intact.
		fireEvent.click(within(dialog).getByRole("button", { name: tc("leave.stay") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(clicks).not.toHaveBeenCalled();
		expect(changes(2)).toBeInTheDocument();

		// 저장하지 않고 나가기: the click goes on to the link.
		fireEvent.click(link);
		const again = await screen.findByRole("alertdialog");
		fireEvent.click(within(again).getByRole("button", { name: tc("leave.confirm") }));
		await waitFor(() => expect(clicks).toHaveBeenCalledTimes(1));
		window.removeEventListener("click", onWindowClick);
	});
});

describe("flow 11 · 개발 서버 · 언어: the content languages of the file", () => {
	const adminName = (code: string) => new Intl.DisplayNames([testSite.ADMIN_LANGUAGE], { type: "language" }).of(code);
	/** The names the languages of these tests are shown by. */
	const NAMES = ["Deutsch", "English", "svenska", "tlhIngan Hol"];
	/** The language rows of the list, in their order (the first is the default), each by its name. A language taken out stays as a marked row, which is left out. */
	const rows = () =>
		screen
			.getAllByRole("listitem")
			.filter((item) => !within(item).queryByRole("img", { name: tLocales("locales.removed") }))
			.map((item) => NAMES.find((name) => item.textContent?.includes(name)));
	const row = (name: string) =>
		screen.getAllByRole("listitem").find((item) => item.textContent?.includes(name)) as HTMLElement;
	const searchBox = () => screen.findByRole("combobox", { name: tLocales("locales.search") });
	const addButton = () => screen.findByRole("button", { name: tLocales("locales.add") });

	it("SET-L1 05 + 언어 추가 opens a code finder: typing zh lists the zh variants, the last item is 직접 입력", async () => {
		open("locales");
		fireEvent.click(await addButton());
		const search = await searchBox();
		type(search, "zh");
		const list = await screen.findByRole("listbox", { name: tLocales("locales.codes") });
		const custom = `${tLocales("locales.custom")}zh`;
		const texts = within(list)
			.getAllByRole("option")
			.map((option) => option.textContent ?? "");
		expect(texts.filter((text) => text !== custom).map((text) => text.split(/[^A-Za-z-]/)[0])).toEqual([
			"zh-Hans",
			"zh-Hant",
			"zh-HK",
		]);
		// One more asks for the names, and carries what was typed.
		expect(texts.filter((text) => text === custom)).toHaveLength(1);
	});

	it("SET-L1 06 picking a code adds the row at once with names from the code; it is listed in the changes and undone from there", async () => {
		open("locales");
		fireEvent.click(await addButton());
		type(await searchBox(), "sv");
		const list = await screen.findByRole("listbox", { name: tLocales("locales.codes") });
		fireEvent.click(within(list).getByRole("option"));
		await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

		// No form: the row is there, named in its own language, marked new.
		expect(rows()).toEqual(["Deutsch", "English", "svenska"]);
		expect(within(row("svenska")).getByRole("img", { name: tChanges("tag.added") })).toBeInTheDocument();
		expect(changes(1)).toBeInTheDocument();

		// The request carries the names from the code: its own name and the admin language's.
		const schema = await save();
		const label = adminName("sv");
		expect(schema.locales.at(-1)).toEqual(
			label === "svenska" ? { code: "sv", name: "svenska" } : { code: "sv", name: "svenska", label },
		);
	});

	it("SET-L1 06b 직접 입력 asks the two names once; 추가 adds the row with them", async () => {
		open("locales");
		fireEvent.click(await addButton());
		type(await searchBox(), "tlh");
		const custom = within(await screen.findByRole("listbox")).getByRole("option");
		expect(custom.textContent).toBe(`${tLocales("locales.custom")}tlh`);
		fireEvent.click(custom);

		// A small window: the code as typed (text, not an input), then the two names. Adding needs both.
		const dialog = await screen.findByRole("dialog", { name: new RegExp(`${tLocales("locales.newTitle")}.*tlh`) });
		expect(within(dialog).getByText("tlh")).toBeInTheDocument();
		expect(within(dialog).queryByRole("textbox", { name: tLocales("locales.code") })).toBeNull();
		const add = within(dialog).getByRole("button", { name: tc("add") }) as HTMLButtonElement;
		expect(add.disabled).toBe(true);
		type(within(dialog).getByRole("textbox", { name: tLocales("locales.name") }), "tlhIngan Hol");
		expect(add.disabled).toBe(true);
		type(within(dialog).getByRole("textbox", { name: tLocales("locales.label") }), "클링온어");
		expect(add.disabled).toBe(false);
		fireEvent.click(add);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

		expect(rows()).toEqual(["Deutsch", "English", "tlhIngan Hol"]);
		expect(changes(1)).toBeInTheDocument();
		expect((await save()).locales.at(-1)).toEqual({ code: "tlh", name: "tlhIngan Hol", label: "클링온어" });
	});

	it("SET-L2 07b · the request has defaultLocale and the new order", async () => {
		open("locales");
		fireEvent.click(await screen.findByRole("button", { name: tLocales("locales.sourceChange") }));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "English" }));
		await waitFor(() => expect(rows()).toEqual(["English", "Deutsch"]));
		const schema = await save();
		expect(schema.defaultLocale).toBe("en");
		expect(schema.locales.map((locale) => locale.code)).toEqual(["en", "de"]);
	});

	it("SET-L2 08 × takes a language out of the list and out of the request; the review of what happens to its translations is the schema review's", async () => {
		open("locales");
		fireEvent.click(await screen.findByRole("button", { name: tLocales("locales.remove", { name: "English" }) }));
		expect(rows()).toEqual(["Deutsch"]);
		expect(changes(1)).toBeInTheDocument();
		const schema = await save();
		expect(schema.locales.map((locale) => locale.code)).toEqual(["de"]);
		expect(schema.defaultLocale).toBe("de");
		// With one language left there is nothing to take out and nothing to change.
		expect(screen.queryByRole("button", { name: new RegExp(tLocales("locales.sourceChange")) })).toBeNull();
		expect(screen.queryByRole("button", { name: tLocales("locales.remove", { name: "Deutsch" }) })).toBeNull();
	});
});
