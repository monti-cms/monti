import type { StoredDocument } from "@monti-cms/core/document";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { CmsIssue } from "../../../api/error-message";
import { commonMessages } from "../../../lib/common.messages";
import { type FakeApi, failure, fakeApi } from "../../../test/fake-api";
import { docOf } from "../../../test/mdx";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { toast } from "../../../test/ui-toast";
import { screensMessages } from "../../messages";
import { statusBarMessages } from "../../shared/status-bar.messages";
import { entryCompareMessages } from "../entry-compare.messages";
import { EntryEditorShell } from "../entry-editor-shell";
import { entryEditorShellMessages } from "../entry-editor-shell.messages";
import { type EntryData, formFingerprint, formFromEntry } from "../entry-form";
import { entriesMessages } from "../messages";

const tEntryEditorShell = testSite.createTranslator(entryEditorShellMessages);
const tScreens = testSite.createTranslator(screensMessages);
const tEntries = testSite.createTranslator(entriesMessages);
const tStatusBar = testSite.createTranslator(statusBarMessages);
const tEntryCompare = testSite.createTranslator(entryCompareMessages);
const TITLE_LABEL = testSite.titleField("post").field.label;
const tCommon = testSite.createTranslator(commonMessages);

// One describe for each row of flow 1 that this screen owns (the canvas rows "글 쓰고 발행하기", "다른 곳에서 먼저 저장" and "다시 열었을 때 임시 저장본"). They
// check what a screenshot cannot: the requests a press sends, where it goes, the names and roles, what is enabled and the keys.

const { getLocalBackup, deleteLocalBackup, saveLocalBackup } = vi.hoisted(() => ({
	getLocalBackup: vi.fn(),
	deleteLocalBackup: vi.fn(),
	saveLocalBackup: vi.fn(),
}));
vi.mock("../local-backup", async (importOriginal) => ({
	...(await importOriginal<typeof import("../local-backup")>()),
	getLocalBackup: (key: string) => getLocalBackup(key),
	deleteLocalBackup: (key: string) => deleteLocalBackup(key),
	saveLocalBackup: (record: unknown) => saveLocalBackup(record),
}));
// The body editor is not under test: the title field it is handed is what these flows type into.
vi.mock("../../../editor/tiptap-editor", () => ({
	CmsEditor: ({ titleField }: { titleField?: React.ReactNode }) => <div>{titleField}</div>,
}));
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
	collection: "post",
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "first-post",
	publishedSlug: null,
	working: { metadata: { title: "첫 번째 글", categoryId: "cat-1", summary: "한 줄 소개" }, doc: BODY },
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
const saves = () => api.sent("PATCH /v1/entries/:id");
const publishes = () => api.sent("POST /v1/entries/:id/publish");

const told = (issue: { code: string; path?: string; message?: string; position?: { blockId: string } }): CmsIssue => ({
	...issue,
	text: "서버 문구",
	...(issue.path ? { where: issue.path } : {}),
});
const missingCategory = told({ code: "missing_field", path: "categoryId", message: "카테고리" });
const noAlt = (index: number) =>
	told({ code: "missing_image_alt", path: "body", position: { blockId: imageIds[index] as string } });

const renderEdit = () =>
	nav.render(withSite(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />));
const title = () => screen.findByRole("textbox", { name: TITLE_LABEL });
const bar = async () => within(await screen.findByRole("region", { name: tScreens("column.status") }));
const pressSave = () => fireEvent.keyDown(window, { key: "s", metaKey: true });
const header = () => within(screen.getByRole("banner"));
const status = () => screen.getByTestId("entry-status-chip").textContent;

beforeEach(() => {
	vi.clearAllMocks();
	nav.setSearch("");
	server = new Server();
	api = fakeApi().install();
	server.mount(api);
	getLocalBackup.mockResolvedValue(null);
	deleteLocalBackup.mockResolvedValue(undefined);
	saveLocalBackup.mockResolvedValue(true);
	vi.stubGlobal("open", vi.fn());
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("flow: write and publish (steps 09–15)", () => {
	it("keeps the save button in the header, with no shortcut on it, and saves with the button and with ⌘S", async () => {
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
		expect(await (await bar()).findByText(/^저장됨 /)).toBeInTheDocument();

		fireEvent.change(await title(), { target: { value: "다시 고침" } });
		pressSave();
		await waitFor(() => expect(saves()).toHaveLength(2));
		expect(saves()[1]?.body).toMatchObject({ expectedVersion: 5 });
		await waitFor(() => expect(toast).toHaveBeenCalledWith("저장했어요."));
	});

	it("starts with the collection as a link back, the full path and the status", async () => {
		renderEdit();
		await title();
		const back = header().getByRole("link", { name: "게시글" });
		expect(back.getAttribute("href")).toBe(testSite.adminHref("?collection=post"));
		expect(header().getByText("/posts/first-post")).toBeInTheDocument();
		expect(status()).toBe("초안");
	});

	it("blocks a publish that finds to-dos: a toast with their number, the list opens, and a row goes to its field", async () => {
		server.publishRefusal = [missingCategory, noAlt(0), noAlt(1)];
		renderEdit();
		await title();
		fireEvent.click(header().getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith("발행할 수 없어요. 아래 할 일 2개를 먼저 고쳐요."));
		const list = within(await screen.findByRole("dialog"));
		// The rows place images by their number in this entry's body.
		expect(list.getByRole("button", { name: /대체 텍스트 없는 이미지 2개/ }).textContent).toContain("본문 1 · 본문 2");
		expect(await (await bar()).findByRole("button", { name: "할 일 2" })).toBeInTheDocument();
		fireEvent.click(list.getByRole("button", { name: /카테고리 고르기/ }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("sends nothing to publish while a refusal is the answer, and the entry stays a draft", async () => {
		server.publishRefusal = [missingCategory];
		renderEdit();
		await title();
		fireEvent.click(header().getByRole("button", { name: tEntryEditorShell("publish") }));
		await screen.findByRole("dialog");
		expect(status()).toBe("초안");
		expect(
			header()
				.getByRole("button", { name: tEntryEditorShell("publish") })
				.hasAttribute("disabled"),
		).toBe(false);
	});

	it("lists the to-dos fixed along the way as check rows, and says nothing is left when they are all gone", async () => {
		server.checkAnswer = { issues: [missingCategory, noAlt(0), noAlt(1)], warnings: [] };
		renderEdit();
		fireEvent.click(await (await bar()).findByRole("button", { name: "할 일 2" }));
		await screen.findByRole("dialog");
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

		// The check runs again after a save: now it finds nothing.
		server.checkAnswer = { issues: [], warnings: [] };
		fireEvent.change(await title(), { target: { value: "채움" } });
		pressSave();
		fireEvent.click(await (await bar()).findByRole("button", { name: tStatusBar("todo.none") }));
		const list = within(await screen.findByRole("dialog"));
		expect(list.getByText("이미지 대체 텍스트 2개")).toBeInTheDocument();
		expect(list.queryByRole("button")).toBeNull();
	});

	it("publishes with the version it saved, tells it in a toast whose 보기 opens the public page, and the button then reads 발행됨, dimmed", async () => {
		renderEdit();
		fireEvent.change(await title(), { target: { value: "발행할 글" } });
		fireEvent.click(header().getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(publishes()).toHaveLength(1));
		// A publish saves the input first, and publishes the version that save made.
		expect(saves()).toHaveLength(1);
		expect(publishes()[0]?.body).toMatchObject({ expectedVersion: 5 });

		await waitFor(() => expect(toast).toHaveBeenCalledWith("발행되었어요.", expect.anything()));
		const options = toast.mock.calls.find(([message]) => message === "발행되었어요.")?.[1] as {
			action: { label: string; onClick: () => void };
		};
		expect(options.action.label).toBe("보기");
		options.action.onClick();
		expect(window.open).toHaveBeenCalledWith("/posts/first-post", "_blank", "noopener");

		await waitFor(() => expect(status()).toBe("발행됨"));
		const done = header().getByRole("button", { name: tEntryEditorShell("publishedState") });
		expect(done.hasAttribute("disabled")).toBe(true);
	});

	it("after a change the status reads 수정 중 and the publish menu has two rows: keep the date, or republish with today's date", async () => {
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
		await waitFor(() => expect(status()).toBe("수정 중"));

		fireEvent.click(header().getByRole("button", { name: tEntryEditorShell("publishOptions") }));
		const rows = await screen.findAllByRole("menuitem");
		expect(rows.map((row) => row.textContent)).toEqual([
			expect.stringMatching(/^발행하기발행일 2026\. 10\. 01 그대로$/),
			expect.stringMatching(/^오늘 날짜로 다시 발행발행일 \d{4}\. \d{2}\. \d{2}$/),
		]);

		fireEvent.click(rows[1] as HTMLElement);
		await waitFor(() => expect(publishes()).toHaveLength(1));
		expect(publishes()[0]?.body).toMatchObject({ expectedVersion: 7, resetPublishedAt: true });
		await waitFor(() => expect(status()).toBe("발행됨"));
	});

	it("keeps the original date when the main half is pressed", async () => {
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
		await waitFor(() => expect(status()).toBe("수정 중"));
		fireEvent.click(header().getByRole("button", { name: tEntryEditorShell("publish") }));
		await waitFor(() => expect(publishes()).toHaveLength(1));
		expect(publishes()[0]?.body?.resetPublishedAt).toBeFalsy();
	});

	it("shows the reason a preview cannot open in place, beside the button, not in a tooltip", async () => {
		server.entry = { ...draft, workingSlug: "" };
		renderEdit();
		await title();
		const preview = header().getByRole("button", { name: /미리보기/ });
		expect(preview.getAttribute("aria-disabled")).toBe("true");
		expect(header().getByText(tEntryEditorShell("preview.no-slug"))).toBeInTheDocument();
	});
});

describe("flow: saved elsewhere first", () => {
	const changedAt = "2026-10-26T01:41:00.000Z";
	/** Someone else saved version 9 while this screen holds version 4; the first save meets the conflict. */
	async function conflicted() {
		renderEdit();
		fireEvent.change(await title(), { target: { value: "내 입력" } });
		server.entry = {
			...draft,
			version: 9,
			changedAt,
			working: {
				metadata: { ...draft.working.metadata, title: "서버 최신 제목", summary: "다른 곳에서 쓴 소개" },
				doc: BODY,
			},
		};
		pressSave();
		return await screen.findByRole("alert");
	}

	it("shows a notice strip above the editor, not a dialog: the time it was saved, and compare and load the server version", async () => {
		const strip = within(await conflicted());
		expect(strip.getByText("다른 곳에서 10:41에 먼저 저장했어요")).toBeInTheDocument();
		expect(strip.getByText(tEntryCompare("conflict.meta"))).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(strip.getByRole("link", { name: tEntryCompare("compare") }).getAttribute("href")).toBe(
			`${EDIT_HREF}?compare=conflict`,
		);
		expect(strip.getByRole("button", { name: tEntryCompare("loadServer") })).toBeInTheDocument();
		expect((await bar()).getAllByText(tStatusBar("save.conflict")).length).toBeGreaterThan(0);
		expect(((await title()) as HTMLInputElement).value).toBe("내 입력");
	});

	it("loads the server version from the strip without reloading the page, and drops the local copy", async () => {
		const strip = within(await conflicted());
		fireEvent.click(strip.getByRole("button", { name: tEntryCompare("loadServer") }));
		await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
		await waitFor(async () => expect(((await title()) as HTMLInputElement).value).toBe("서버 최신 제목"));
		expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:entry-1`);
		expect(saves()).toHaveLength(1);
	});

	it("compares on a screen of its own: both entries side by side with the differences counted, the way back, and the status bar's cell", async () => {
		await conflicted();
		act(() => nav.setSearch("compare=conflict"));
		expect(
			await screen.findByRole("heading", { level: 1, name: tEntryCompare("heading.conflict") }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: tEntryCompare("back") }).getAttribute("href")).toBe(EDIT_HREF);
		expect(screen.getByText("/posts/first-post")).toBeInTheDocument();
		const mine = within(screen.getByRole("region", { name: tEntryCompare("side.mine") }));
		const theirs = within(screen.getByRole("region", { name: "서버 최신본 · v9 · 10:41 저장" }));
		expect(mine.getByRole("heading", { level: 2, name: "내 입력" })).toBeInTheDocument();
		expect(theirs.getByRole("heading", { level: 2, name: "서버 최신 제목" })).toBeInTheDocument();
		// The properties that differ are on top of each side; the title is counted with them: the title and the summary.
		expect((theirs.getByText("요약").parentElement as HTMLElement).textContent).toContain("다른 곳에서 쓴 소개");
		const statusBar = within(screen.getByRole("region", { name: tScreens("column.status") }));
		expect(statusBar.getByText(tStatusBar("save.conflict"))).toBeInTheDocument();
		expect(statusBar.getByText("다른 곳 2")).toBeInTheDocument();
		expect(screen.getAllByText("다른 곳 2").length).toBeGreaterThanOrEqual(2);
		// The editor is gone from the screen while comparing.
		expect(screen.queryByRole("textbox", { name: tScreens("column.title") })).toBeNull();
	});

	it("picks the server version on the compare screen, and goes back to the editor with it", async () => {
		await conflicted();
		act(() => nav.setSearch("compare=conflict"));
		fireEvent.click(await screen.findByRole("button", { name: tEntryCompare("loadServer") }));
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(EDIT_HREF));
		await waitFor(async () => expect(((await title()) as HTMLInputElement).value).toBe("서버 최신 제목"));
		expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:entry-1`);
	});

	it("picks my input on the compare screen: it is saved on top of the server's version without asking again, and the editor opens", async () => {
		await conflicted();
		act(() => nav.setSearch("compare=conflict"));
		fireEvent.click(await screen.findByRole("button", { name: tEntryCompare("saveMine") }));
		await waitFor(() => expect(saves()).toHaveLength(2));
		expect(saves()[1]?.body).toMatchObject({
			expectedVersion: 9,
			metadata: expect.objectContaining({ title: "내 입력" }),
		});
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(EDIT_HREF));
		expect(server.entry.version).toBe(10);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("goes back to the editor from the compare screen with the conflict still there", async () => {
		await conflicted();
		act(() => nav.setSearch("compare=conflict"));
		await screen.findByRole("heading", { level: 1, name: tEntryCompare("heading.conflict") });
		act(() => nav.setSearch(""));
		expect(await screen.findByRole("alert")).toBeInTheDocument();
		expect(((await title()) as HTMLInputElement).value).toBe("내 입력");
	});

	it("leaves the compare address when there is nothing to compare", async () => {
		nav.setSearch("compare=conflict");
		renderEdit();
		await title();
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(EDIT_HREF));
	});
});

describe("flow: browser draft on reopening", () => {
	const savedAt = Date.parse("2026-10-26T01:12:00.000Z");
	function keepDraft(over: Record<string, unknown> = {}, baseVersion = 4) {
		const base = formFromEntry(testSite, draft);
		const snapshot = { ...base, title: "브라우저에 남은 제목", summary: "임시 소개", ...over };
		getLocalBackup.mockResolvedValue({
			key: `${ADMIN}:entry-1`,
			entryId: "entry-1",
			baseVersion,
			baseFingerprint: formFingerprint(testSite, base),
			localFingerprint: formFingerprint(testSite, snapshot),
			snapshot,
			changeSeq: 1,
			savedAt,
		});
	}

	it("shows a notice strip when the entry opens: when it was kept, and compare, load and discard", async () => {
		keepDraft();
		renderEdit();
		const sentence = await screen.findByText(tEntryCompare("draft.title"));
		const strip = within(sentence.closest("[data-slot=banner]") as HTMLElement);
		expect(strip.getByText(tEntryCompare("draft.title"))).toBeInTheDocument();
		expect(strip.getByText("10. 26 10:12")).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(strip.getByRole("link", { name: tEntryCompare("compare") }).getAttribute("href")).toBe(
			`${EDIT_HREF}?compare=draft`,
		);
		expect(strip.getByRole("button", { name: tEntryCompare("load") })).toBeInTheDocument();
		expect(strip.getByRole("button", { name: tEntryCompare("discard") })).toBeInTheDocument();
		// The status bar says the same: until the draft is answered, what is kept is only in this browser.
		expect((await bar()).getAllByText(tEntries("save.local-only")).length).toBeGreaterThan(0);
	});

	it("loads the draft into the editor from the strip, and discards it from the strip", async () => {
		keepDraft();
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: tEntryCompare("load") }));
		await waitFor(async () => expect(((await title()) as HTMLInputElement).value).toBe("브라우저에 남은 제목"));
		expect(screen.queryByRole("button", { name: tEntryCompare("discard") })).toBeNull();
		expect((await bar()).getByRole("button", { name: tEntries("save.dirty") })).toBeInTheDocument();

		cleanup();
		vi.clearAllMocks();
		keepDraft();
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: tEntryCompare("discard") }));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:entry-1`));
		await waitFor(() => expect(screen.queryByRole("button", { name: tEntryCompare("discard") })).toBeNull());
		expect(((await title()) as HTMLInputElement).value).toBe("첫 번째 글");
	});

	it("compares the draft with the server copy on the compare screen, and picks the draft there", async () => {
		server.entry = { ...draft, changedAt: "2026-10-26T00:58:00.000Z" };
		keepDraft();
		renderEdit();
		await screen.findByRole("button", { name: tEntryCompare("load") });
		act(() => nav.setSearch("compare=draft"));
		expect(await screen.findByRole("heading", { level: 1, name: tEntryCompare("heading.draft") })).toBeInTheDocument();
		const left = within(screen.getByRole("region", { name: "임시 저장본 · 이 브라우저 · 10. 26 10:12" }));
		expect(left.getByRole("heading", { level: 2, name: "브라우저에 남은 제목" })).toBeInTheDocument();
		expect(screen.getByRole("region", { name: "서버 저장본 · 10. 26 09:58" })).toBeInTheDocument();
		const statusBar = within(screen.getByRole("region", { name: tScreens("column.status") }));
		expect(statusBar.getByText(tEntries("save.local-only"))).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: tEntryCompare("loadDraft") }));
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(EDIT_HREF));
		await waitFor(async () => expect(((await title()) as HTMLInputElement).value).toBe("브라우저에 남은 제목"));
	});

	it("discards the draft from the compare screen and goes back to the editor with the server's copy", async () => {
		keepDraft();
		renderEdit();
		await screen.findByRole("button", { name: tEntryCompare("load") });
		act(() => nav.setSearch("compare=draft"));
		fireEvent.click(await screen.findByRole("button", { name: tEntryCompare("discard") }));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:entry-1`));
		await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(EDIT_HREF));
		expect(((await title()) as HTMLInputElement).value).toBe("첫 번째 글");
	});
});
