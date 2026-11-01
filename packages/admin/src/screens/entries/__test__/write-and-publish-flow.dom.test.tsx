import { SUMMARY_ROLE } from "@monti-cms/core";
import type { StoredDocument } from "@monti-cms/core/document";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, requiredFields } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import type { CmsIssue } from "../../../api/error-message";
import { commonMessages } from "../../../lib/common.messages";
import { type FakeApi, failure, fakeApi } from "../../../test/fake-api";
import { type FakeIndexedDB, installFakeIndexedDB } from "../../../test/fake-indexed-db";
import { docOf } from "../../../test/mdx";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { toast } from "../../../test/ui-toast";
import { screensMessages } from "../../messages";
import { sharedMessages } from "../../shared/messages";
import { publishReadinessMessages } from "../../shared/publish-readiness.messages";
import { statusBarMessages } from "../../shared/status-bar.messages";
import { entryCompareMessages } from "../entry-compare.messages";
import { EntryEditorShell } from "../entry-editor-shell";
import { entryEditorShellMessages } from "../entry-editor-shell.messages";
import { type EntryData, type EntryForm, type EntryFormPatch, formFingerprint, formFromEntry } from "../entry-form";
import { shortDate } from "../entry-stamps";
import { entriesMessages } from "../messages";

const tEntryEditorShell = testSite.createTranslator(entryEditorShellMessages);
const tScreens = testSite.createTranslator(screensMessages);
const tEntries = testSite.createTranslator(entriesMessages);
const tStatusBar = testSite.createTranslator(statusBarMessages);
const tEntryCompare = testSite.createTranslator(entryCompareMessages);
const tShared = testSite.createTranslator(sharedMessages);
const tPublishReadiness = testSite.createTranslator(publishReadinessMessages);
const TITLE_LABEL = testSite.titleField(contentCollection).field.label;
/** A relation the collection needs before publishing (the blog's category, another site's author): the to-do a refused publish names. */
const REQUIRED_RELATION = requiredFields(contentCollection).find(({ field }) => field.kind === "relation");
if (!REQUIRED_RELATION) throw new Error(`${contentCollection} has no required relation field`);
/** The collection's summary: the second property the compare screen counts as changed, after the title. */
const SUMMARY = testSite.roleField(contentCollection, SUMMARY_ROLE);
if (!SUMMARY) throw new Error(`${contentCollection} has no summary field`);
const SUMMARY_NAME = SUMMARY.name;
/** The time of day of a moment on a 24-hour clock in the site's time zone (the blog's is 9 hours ahead of UTC, another site's may be UTC). */
const siteClock = (iso: string) =>
	new Intl.DateTimeFormat("en-GB", {
		timeZone: testSite.CMS_TIME_ZONE,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(new Date(iso));
/** Where the entry's slug puts it on the public site. */
const PUBLIC_PATH = testSite.localizePath(
	testSite.DEFAULT_LOCALE,
	testSite.contentPath(contentCollection, "first-post") ?? "",
);
const tCommon = testSite.createTranslator(commonMessages);

// One describe for each row of flow 1 that this screen owns (the canvas rows "글 쓰고 발행하기", "다른 곳에서 먼저 저장" and "다시 열었을 때 임시 저장본"). They
// check what a screenshot cannot: the requests a press sends, where it goes, the names and roles, what is enabled and the keys.

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const nav = createTestRouter();
const ADMIN = "u1";
const EDIT_HREF = testSite.adminEntryEditHref("entry-1");
const BODY = docOf("첫 문단\n\n![](a.png)\n\n![](b.png)");
const imageIds = BODY.content.filter((node) => node.type === "image").map((node) => String(node.id));

const draft: EntryData = {
	id: "entry-1",
	collection: contentCollection,
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "first-post",
	publishedSlug: null,
	working: {
		metadata: { title: "첫 번째 글", [REQUIRED_RELATION.name]: "rel-1", [SUMMARY_NAME]: "한 줄 소개" },
		doc: BODY,
	},
};

/** A server with one entry: it checks the version of a save and a publish, as the real one does. */
class Server {
	entry: EntryData = structuredClone(draft);
	checkAnswer: { issues: CmsIssue[]; warnings: CmsIssue[] } = { issues: [], warnings: [] };
	publishRefusal: CmsIssue[] | null = null;
	clock = "2026-10-26T01:41:00.000Z";

	private conflict = () => failure("conflict", "Conflict", { details: { serverVersion: this.entry.version } });

	/** Answers the routes of the editor through `api`. */
	mount(api: FakeApi) {
		const known = (id: string | undefined) => id === this.entry.id;
		api
			.on("GET /v1/entries/:id/relations", () => ({ incomingReferences: [] }))
			.on("POST /v1/entries/:id/check", () => this.checkAnswer)
			.on("GET /v1/entries/:id", ({ params }) =>
				known(params.id) ? structuredClone(this.entry) : failure("not_found"),
			)
			.on("PATCH /v1/entries/:id", ({ params, body }) => {
				if (!known(params.id)) return failure("not_found");
				if (body?.expectedVersion !== this.entry.version) return this.conflict();
				this.entry = {
					...this.entry,
					version: this.entry.version + 1,
					workingSlug: String(body.slug ?? this.entry.workingSlug),
					working: { metadata: body.metadata, doc: body.doc as StoredDocument },
				};
				return { entry: structuredClone(this.entry), warnings: [] };
			})
			.on("POST /v1/entries/:id/publish", ({ params, body }) => {
				if (!known(params.id)) return failure("not_found");
				if (this.publishRefusal)
					return failure("publish_validation_failed", "publish_validation_failed", { issues: this.publishRefusal });
				if (body?.expectedVersion !== this.entry.version) return this.conflict();
				this.entry = {
					...this.entry,
					status: "published",
					version: this.entry.version + 1,
					publishedSlug: this.entry.workingSlug,
					publishedAt: body.resetPublishedAt || !this.entry.publishedAt ? this.clock : this.entry.publishedAt,
					published: structuredClone(this.entry.working),
				};
				return { entry: structuredClone(this.entry), warnings: [] };
			});
	}
}

let server: Server;
let api: FakeApi;
/** The browser's recovery database: the editor keeps and drops its copy there through the real `local-backup` module. */
let idb: FakeIndexedDB;
const BACKUP_KEY = `${ADMIN}:entry-1`;
const backup = () => idb.backupOf(testSite, BACKUP_KEY);
const saves = () => api.sent("PATCH /v1/entries/:id");
const publishes = () => api.sent("POST /v1/entries/:id/publish");

const told = (issue: { code: string; path?: string; message?: string; position?: { blockId: string } }): CmsIssue => ({
	...issue,
	text: "서버 문구",
	...(issue.path ? { where: issue.path } : {}),
});
const missingRelation = told({
	code: "missing_field",
	path: REQUIRED_RELATION.name,
	message: REQUIRED_RELATION.field.label,
});
const noAlt = (index: number) =>
	told({ code: "missing_image_alt", path: "body", position: { blockId: imageIds[index] as string } });

const renderEdit = () =>
	nav.render(withSite(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />));
const title = () => screen.findByRole("textbox", { name: TITLE_LABEL });
const bar = async () => within(await screen.findByRole("region", { name: tScreens("column.status") }));
const pressSave = () => fireEvent.keyDown(window, { key: "s", metaKey: true });
const header = () => within(screen.getByRole("banner"));
/** The header's status mark reads `name` (a status has no role of its own; the header's buttons are told apart by role). */
const headerStatus = (name: string) => header().findByText(name, { ignore: "button, button *" });
/** The notice strip (a `status` region) whose sentence is `sentence`. */
const stripWith = async (sentence: string) => {
	await screen.findByText(sentence);
	const strip = screen.getAllByRole("status").find((region) => within(region).queryByText(sentence) !== null);
	if (!strip) throw new Error(`no notice strip says ${sentence}`);
	return within(strip);
};
/** A name that starts with `start` and holds `part` (a menu row's name is its label followed by its caption). */
const startingWith = (start: string, part: string) => (name: string) => name.startsWith(start) && name.includes(part);

beforeEach(() => {
	vi.clearAllMocks();
	nav.setSearch("");
	server = new Server();
	api = fakeApi().install();
	server.mount(api);
	idb = installFakeIndexedDB();
	vi.stubGlobal("open", vi.fn());
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("flow: write and publish (steps 09–15)", () => {
	it("WRITE-S1 keeps the save button in the header, with no shortcut on it, and saves with the button and with ⌘S", async () => {
		renderEdit();
		await title();
		// A button shows no shortcut, and the save button is there while nothing is changed.
		const save = header().getByRole("button", { name: tCommon("save") });
		expect(save.hasAttribute("disabled")).toBe(false);

		fireEvent.change(await title(), { target: { value: "고친 제목" } });
		expect((await bar()).getByRole("button", { name: tEntries("save.dirty") })).toBeInTheDocument();
		fireEvent.click(save);
		await waitFor(() => expect(saves()).toHaveLength(1));
		expect(saves()[0]?.body).toMatchObject({
			expectedVersion: 4,
			metadata: expect.objectContaining({ title: "고친 제목" }),
		});
		expect(await (await bar()).findByText(tStatusBar("save.word.saved"))).toBeInTheDocument();

		fireEvent.change(await title(), { target: { value: "다시 고침" } });
		pressSave();
		await waitFor(() => expect(saves()).toHaveLength(2));
		expect(saves()[1]?.body).toMatchObject({ expectedVersion: 5 });
		await waitFor(() => expect(toast).toHaveBeenCalledWith(tCommon("saved")));
	});

	it("WRITE-P1 blocks a publish that finds to-dos: a toast with their number, the list opens, and a row goes to its field", async () => {
		server.publishRefusal = [missingRelation, noAlt(0), noAlt(1)];
		renderEdit();
		await title();
		fireEvent.click(header().getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith(tEntryEditorShell("publishBlocked", { count: 2 })));
		const list = within(await screen.findByRole("dialog"));
		// The rows place images by their number in this entry's body.
		const places = [1, 2].map((number) => tPublishReadiness("place.body", { number })).join(" · ");
		expect(
			list.getByRole("button", {
				name: startingWith(tPublishReadiness("group.missing_image_alt", { count: 2 }), places),
			}),
		).toBeInTheDocument();
		expect(
			await (await bar()).findByRole("button", { name: tStatusBar("todo.count", { count: 2 }) }),
		).toBeInTheDocument();
		const pickRelation = tPublishReadiness("field.pick", { name: REQUIRED_RELATION.field.label });
		fireEvent.click(list.getByRole("button", { name: startingWith(pickRelation, pickRelation) }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("WRITE-P1 lists the to-dos fixed along the way as check rows, and says nothing is left when they are all gone", async () => {
		server.checkAnswer = { issues: [missingRelation, noAlt(0), noAlt(1)], warnings: [] };
		renderEdit();
		fireEvent.click(await (await bar()).findByRole("button", { name: tStatusBar("todo.count", { count: 2 }) }));
		await screen.findByRole("dialog");
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

		// The check runs again after a save: now it finds nothing.
		server.checkAnswer = { issues: [], warnings: [] };
		fireEvent.change(await title(), { target: { value: "채움" } });
		pressSave();
		fireEvent.click(await (await bar()).findByRole("button", { name: tStatusBar("todo.none") }));
		const list = within(await screen.findByRole("dialog"));
		expect(list.getByText(tPublishReadiness("done.imageAlt", { count: 2 }))).toBeInTheDocument();
		expect(list.queryByRole("button")).toBeNull();
	});

	it("WRITE-P2 publishes with the version it saved, tells it in a toast whose 보기 opens the public page, and the button then reads 발행됨, dimmed", async () => {
		renderEdit();
		fireEvent.change(await title(), { target: { value: "발행할 글" } });
		fireEvent.click(header().getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(publishes()).toHaveLength(1));
		// A publish saves the input first, and publishes the version that save made.
		expect(saves()).toHaveLength(1);
		expect(publishes()[0]?.body).toMatchObject({ expectedVersion: 5 });

		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(tEntryEditorShell("published"), {
				action: { label: tEntryEditorShell("view"), onClick: expect.any(Function) },
			}),
		);
		// The toast's own button: the action of the call that told the publish.
		const [, options] = toast.mock.calls.find(([message]) => message === tEntryEditorShell("published")) ?? [];
		(options as { action: { onClick: () => void } }).action.onClick();
		expect(window.open).toHaveBeenCalledWith(PUBLIC_PATH, "_blank", "noopener");

		const done = await header().findByRole("button", { name: tEntryEditorShell("publishedState") });
		expect(done.hasAttribute("disabled")).toBe(true);
	});

	it("WRITE-P5 after a change the status reads 수정 중 and the publish menu has two rows: keep the date, or republish with today's date", async () => {
		server.entry = {
			...draft,
			status: "published",
			version: 6,
			publishedSlug: "first-post",
			publishedAt: "2026-10-01T00:30:00.000Z",
			published: structuredClone(draft.working),
		};
		renderEdit();
		fireEvent.change(await title(), { target: { value: "발행 뒤에 고침" } });
		expect(await headerStatus(tShared("status.editing"))).toBeInTheDocument();

		fireEvent.click(header().getByRole("button", { name: tEntryEditorShell("publishOptions") }));
		const keepDate = tEntryEditorShell("keepDateCaption", { date: shortDate(testSite, "2026-10-01T00:30:00.000Z") });
		expect(
			await screen.findByRole("menuitem", { name: startingWith(tEntryEditorShell("keepDate"), keepDate) }),
		).toBeInTheDocument();
		const today = tEntryEditorShell("republishCaption", { date: shortDate(testSite, new Date()) });
		fireEvent.click(screen.getByRole("menuitem", { name: startingWith(tEntryEditorShell("republish"), today) }));
		await waitFor(() => expect(publishes()).toHaveLength(1));
		expect(publishes()[0]?.body).toMatchObject({ expectedVersion: 7, resetPublishedAt: true });
		expect(await header().findByRole("button", { name: tEntryEditorShell("publishedState") })).toBeInTheDocument();
	});

	it("WRITE-P5 keeps the original date when the main half is pressed", async () => {
		server.entry = {
			...draft,
			status: "published",
			version: 6,
			publishedSlug: "first-post",
			publishedAt: "2026-10-01T00:30:00.000Z",
			published: structuredClone(draft.working),
		};
		renderEdit();
		fireEvent.change(await title(), { target: { value: "날짜는 그대로" } });
		expect(await headerStatus(tShared("status.editing"))).toBeInTheDocument();
		fireEvent.click(header().getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(publishes()).toHaveLength(1));
		expect(publishes()[0]?.body).not.toHaveProperty("resetPublishedAt");
	});

	it("WRITE-W8 shows the reason a preview cannot open in place, beside the button, not in a tooltip", async () => {
		server.entry = { ...draft, workingSlug: "" };
		renderEdit();
		await title();
		const preview = header().getByRole("button", { name: tEntryEditorShell("preview") });
		expect(preview.getAttribute("aria-disabled")).toBe("true");
		expect(header().getByText(tEntryEditorShell("preview.no-slug"))).toBeInTheDocument();
	});
});

describe("flow: saved elsewhere first", () => {
	const changedAt = "2026-10-26T01:41:00.000Z";
	/** What this screen typed, and the title the other save left on the server. */
	const MINE = "내 입력";
	const THEIRS = "서버 최신 제목";
	/** Someone else saved version 9 while this screen holds version 4; the first save meets the conflict. */
	async function conflicted() {
		renderEdit();
		fireEvent.change(await title(), { target: { value: MINE } });
		server.entry = {
			...draft,
			version: 9,
			changedAt,
			working: {
				metadata: { ...draft.working.metadata, title: THEIRS, [SUMMARY_NAME]: "다른 곳에서 쓴 소개" },
				doc: BODY,
			},
		};
		pressSave();
		return await screen.findByRole("alert");
	}

	it("WRITE-C1 shows a notice strip above the editor, not a dialog: the time it was saved, and compare and load the server version", async () => {
		const strip = within(await conflicted());
		// The time is the site's: 01:41 UTC is 10:41 on the blog.
		expect(strip.getByText(tEntryCompare("conflict.title", { time: siteClock(changedAt) }))).toBeInTheDocument();
		expect(strip.getByText(tEntryCompare("conflict.meta"))).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(strip.getByRole("link", { name: tEntryCompare("compare") }).getAttribute("href")).toBe(
			`${EDIT_HREF}?compare=conflict`,
		);
		expect(strip.getByRole("button", { name: tEntryCompare("loadServer") })).toBeInTheDocument();
		expect((await bar()).getAllByText(tStatusBar("save.conflict")).length).toBeGreaterThan(0);
		expect(((await title()) as HTMLInputElement).value).toBe(MINE);
	});

	it("WRITE-C2 loads the server version from the strip without reloading the page, and drops the local copy", async () => {
		const strip = within(await conflicted());
		// The refused save kept the input in the browser.
		expect(backup()?.snapshot).toMatchObject({ title: MINE });
		fireEvent.click(strip.getByRole("button", { name: tEntryCompare("loadServer") }));
		await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
		await waitFor(async () => expect(((await title()) as HTMLInputElement).value).toBe(THEIRS));
		await waitFor(() => expect(backup()).toBeUndefined());
		expect(saves()).toHaveLength(1);
	});

	it("WRITE-C3 compares on a screen of its own: both entries side by side with the differences counted, the way back, and the status bar's cell", async () => {
		await conflicted();
		act(() => nav.setSearch("compare=conflict"));
		expect(
			await screen.findByRole("heading", { level: 1, name: tEntryCompare("heading.conflict") }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: tEntryCompare("back") }).getAttribute("href")).toBe(EDIT_HREF);
		expect(screen.getByText(PUBLIC_PATH)).toBeInTheDocument();
		const mine = within(screen.getByRole("region", { name: tEntryCompare("side.mine") }));
		const theirSide = screen.getByRole("region", {
			name: tEntryCompare("side.server", { version: 9, time: siteClock(changedAt) }),
		});
		const theirs = within(theirSide);
		expect(mine.getByRole("heading", { level: 2, name: MINE })).toBeInTheDocument();
		expect(theirs.getByRole("heading", { level: 2, name: THEIRS })).toBeInTheDocument();
		// The properties that differ are on top of each side; the title is counted with them: the title and the summary.
		// The changed words are marked apart, so the value is read as the side's text.
		expect(theirSide.textContent).toContain("다른 곳에서 쓴 소개");
		const statusBar = within(screen.getByRole("region", { name: tScreens("column.status") }));
		expect(statusBar.getByText(tStatusBar("save.conflict"))).toBeInTheDocument();
		const differences = tEntryCompare("differences", { count: 2 });
		expect(statusBar.getByText(differences)).toBeInTheDocument();
		expect(screen.getAllByText(differences).length).toBeGreaterThanOrEqual(2);
		// The editor is gone from the screen while comparing.
		expect(screen.queryByRole("textbox", { name: tScreens("column.title") })).toBeNull();
	});

	it("WRITE-C3 picks the server version on the compare screen, and goes back to the editor with it", async () => {
		await conflicted();
		expect(backup()?.snapshot).toMatchObject({ title: MINE });
		act(() => nav.setSearch("compare=conflict"));
		fireEvent.click(await screen.findByRole("button", { name: tEntryCompare("loadServer") }));
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(EDIT_HREF));
		await waitFor(async () => expect(((await title()) as HTMLInputElement).value).toBe(THEIRS));
		await waitFor(() => expect(backup()).toBeUndefined());
	});

	it("WRITE-C3 picks my input on the compare screen: it is saved on top of the server's version without asking again, and the editor opens", async () => {
		await conflicted();
		act(() => nav.setSearch("compare=conflict"));
		fireEvent.click(await screen.findByRole("button", { name: tEntryCompare("saveMine") }));
		await waitFor(() => expect(saves()).toHaveLength(2));
		expect(saves()[1]?.body).toMatchObject({
			expectedVersion: 9,
			metadata: expect.objectContaining({ title: MINE }),
		});
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(EDIT_HREF));
		expect(server.entry.version).toBe(10);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("WRITE-C3 goes back to the editor from the compare screen with the conflict still there", async () => {
		await conflicted();
		act(() => nav.setSearch("compare=conflict"));
		await screen.findByRole("heading", { level: 1, name: tEntryCompare("heading.conflict") });
		act(() => nav.setSearch(""));
		expect(await screen.findByRole("alert")).toBeInTheDocument();
		expect(((await title()) as HTMLInputElement).value).toBe(MINE);
	});

	it("WRITE-C3 leaves the compare address when there is nothing to compare", async () => {
		nav.setSearch("compare=conflict");
		renderEdit();
		await title();
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(EDIT_HREF));
	});
});

describe("flow: browser draft on reopening", () => {
	const savedAt = Date.parse("2026-10-26T01:12:00.000Z");
	/** `savedAt` as the strips write it, in the site's time zone. */
	const KEPT_AT = tEntryCompare("stamp", { month: "10", day: "26", time: siteClock("2026-10-26T01:12:00.000Z") });
	/** The title the browser kept. */
	const KEPT = "브라우저에 남은 제목";
	function keepDraft(over: EntryFormPatch = {}, baseVersion = 4) {
		const base = formFromEntry(testSite, draft);
		const snapshot: EntryForm = { ...base, title: KEPT, [SUMMARY_NAME]: "임시 소개", ...over };
		idb.keep(testSite, {
			key: BACKUP_KEY,
			entryId: "entry-1",
			baseVersion,
			baseFingerprint: formFingerprint(testSite, base),
			localFingerprint: formFingerprint(testSite, snapshot),
			snapshot,
			changeSeq: 1,
			savedAt,
		});
	}

	it("WRITE-R2 shows a notice strip when the entry opens: when it was kept, and compare, load and discard", async () => {
		keepDraft();
		renderEdit();
		const strip = await stripWith(tEntryCompare("draft.title"));
		expect(strip.getByText(KEPT_AT)).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(strip.getByRole("link", { name: tEntryCompare("compare") }).getAttribute("href")).toBe(
			`${EDIT_HREF}?compare=draft`,
		);
		expect(strip.getByRole("button", { name: tEntryCompare("load") })).toBeInTheDocument();
		expect(strip.getByRole("button", { name: tEntryCompare("discard") })).toBeInTheDocument();
		// The status bar says the same: until the draft is answered, what is kept is only in this browser.
		expect((await bar()).getAllByText(tEntries("save.local-only")).length).toBeGreaterThan(0);
	});

	it("WRITE-R2 loads the draft into the editor from the strip, and discards it from the strip", async () => {
		keepDraft();
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: tEntryCompare("load") }));
		await waitFor(async () => expect(((await title()) as HTMLInputElement).value).toBe(KEPT));
		expect(screen.queryByRole("button", { name: tEntryCompare("discard") })).toBeNull();
		expect((await bar()).getByRole("button", { name: tEntries("save.dirty") })).toBeInTheDocument();

		cleanup();
		keepDraft();
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: tEntryCompare("discard") }));
		await waitFor(() => expect(backup()).toBeUndefined());
		await waitFor(() => expect(screen.queryByRole("button", { name: tEntryCompare("discard") })).toBeNull());
		expect(((await title()) as HTMLInputElement).value).toBe("첫 번째 글");
	});

	it("WRITE-R2 compares the draft with the server copy on the compare screen, and picks the draft there", async () => {
		server.entry = { ...draft, changedAt: "2026-10-26T00:58:00.000Z" };
		keepDraft();
		renderEdit();
		await screen.findByRole("button", { name: tEntryCompare("load") });
		act(() => nav.setSearch("compare=draft"));
		expect(await screen.findByRole("heading", { level: 1, name: tEntryCompare("heading.draft") })).toBeInTheDocument();
		const left = within(screen.getByRole("region", { name: tEntryCompare("side.draft", { stamp: KEPT_AT }) }));
		expect(left.getByRole("heading", { level: 2, name: KEPT })).toBeInTheDocument();
		const changed = tEntryCompare("stamp", { month: "10", day: "26", time: siteClock("2026-10-26T00:58:00.000Z") });
		expect(screen.getByRole("region", { name: tEntryCompare("side.saved", { stamp: changed }) })).toBeInTheDocument();
		const statusBar = within(screen.getByRole("region", { name: tScreens("column.status") }));
		expect(statusBar.getByText(tEntries("save.local-only"))).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: tEntryCompare("loadDraft") }));
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(EDIT_HREF));
		await waitFor(async () => expect(((await title()) as HTMLInputElement).value).toBe(KEPT));
	});

	it("WRITE-R2 discards the draft from the compare screen and goes back to the editor with the server's copy", async () => {
		keepDraft();
		renderEdit();
		await screen.findByRole("button", { name: tEntryCompare("load") });
		act(() => nav.setSearch("compare=draft"));
		fireEvent.click(await screen.findByRole("button", { name: tEntryCompare("discard") }));
		await waitFor(() => expect(backup()).toBeUndefined());
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(EDIT_HREF));
		expect(((await title()) as HTMLInputElement).value).toBe("첫 번째 글");
	});
});
