import { issueText } from "@monti-cms/core/site";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { testSite } from "../../../../core/test/site";
import { StatusBarPluginCell } from "../../kit";
import { answer, type FakeApi, PageFrame } from "../../stories/screen-frame";
import { docOf } from "../../test/mdx";
import { StatusCellsProvider, useStatusBarContext } from "../shared/status-bar";
import { EntryEditorShell } from "./entry-editor-shell";
import { type EntryData, type EntryForm, formFingerprint, formFromEntry } from "./entry-form";
import { deleteLocalBackup, saveLocalBackup } from "./local-backup";

// The editor keeps its recovery copy in the browser's IndexedDB, which outlives a story: every story starts without one, so a save that
// failed in one run does not offer its copy in the next.
const meta = {
	title: "Screens/Entry editor",
	parameters: { layout: "fullscreen", bleed: true },
	loaders: [async () => void (await deleteLocalBackup("u1:entry-1", testSite))],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const API = "/api/monti/v1";
const BODY = "첫 문단입니다. 글의 도입부를 이렇게 씁니다.\n\n## 소제목\n\n둘째 문단입니다.\n\n- 목록 하나\n- 목록 둘";

const draft: EntryData = {
	id: "entry-1",
	collection: "post",
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "first-post",
	publishedSlug: null,
	working: {
		metadata: { title: "첫 번째 글", categoryId: "cat-1", summary: "글을 한 줄로 소개합니다." },
		doc: docOf(BODY),
	},
};
const published: EntryData = {
	...draft,
	status: "published",
	publishedSlug: "first-post",
	publishedAt: "2026-10-01T09:30:00.000Z",
	published: draft.working,
};

const member = (id: string, locale: string, status: string, isSource: boolean, title: string) => ({
	id,
	locale,
	status,
	isSource,
	title,
	workingSlug: "first-post",
});
const withTranslations = {
	...published,
	locale: "ko",
	translationGroupId: "entry-1",
	translations: [
		member("entry-1", "ko", "published", true, "첫 번째 글"),
		member("entry-en", "en", "draft", false, "First post"),
	],
};
const translation = {
	...draft,
	id: "entry-en",
	locale: "en",
	translationGroupId: "entry-1",
	translations: withTranslations.translations,
	source: {
		id: "entry-1",
		locale: "ko",
		status: "published",
		workingSlug: "first-post",
		metadata: draft.working.metadata,
		doc: draft.working.doc,
	},
	working: {
		metadata: { title: "First post" },
		doc: docOf("The first paragraph."),
		translation: null,
	},
};

/** A Korean translation of an English original: a language the spell check covers, written in the translation editor. */
const koTranslation = {
	...translation,
	id: "entry-ko",
	locale: "ko",
	translationGroupId: "entry-en",
	translations: [
		member("entry-en", "en", "published", true, "First post"),
		member("entry-ko", "ko", "draft", false, "첫 번째 글"),
	],
	working: { metadata: { title: "첫 번째 글" }, doc: docOf("첫 문단입니다."), translation: null },
	source: { ...translation.source, id: "entry-en", locale: "en", metadata: { title: "First post" } },
};

const told = (issue: Parameters<typeof issueText>[1]) => ({ ...issue, ...issueText(testSite, issue) });
const missingTitle = told({ code: "missing_field", path: "title", message: "제목" });
const missingSummary = told({ code: "missing_field", path: "summary", message: "요약" });

type Server = {
	entry?: unknown;
	/** What `GET /entries/:id` answers instead of the entry (an error, or `"pending"`). */
	load?: unknown;
	/** Problems the publish check finds in the saved draft. */
	issues?: unknown[];
	/** What `PATCH /entries/:id` answers instead of a save. */
	save?: unknown;
	/** What `POST /entries/:id/publish` answers instead of a publish. */
	publish?: unknown;
	/** Extra answers tried first. */
	more?: FakeApi;
};

/** The server for one entry: its answers can be swapped per state. Built per story render so a save changes only that story. */
const server = ({ entry = draft, load, issues = [], save, publish, more }: Server = {}): FakeApi => {
	let current = entry as typeof draft;
	return (path, method) => {
		const extra = more?.(path, method);
		if (extra !== undefined) return extra;
		if (path.startsWith(`${API}/entries/`) && path.endsWith("/check")) return { issues, warnings: [] };
		if (path.endsWith("/relations")) return { incomingReferences: [] };
		if (path.startsWith(`${API}/entries/search`)) return { items: [] };
		if (path.startsWith(`${API}/entries?`)) return { items: [], total: 0 };
		if (path.startsWith(`${API}/media`)) return { items: [], total: 0 };
		if (path.endsWith("/publish") && method === "POST") return publish ?? { entry: current, warnings: [] };
		if (method === "PATCH") {
			if (save !== undefined) return save;
			current = { ...current, version: current.version + 1 };
			return { entry: current, warnings: [] };
		}
		if (method === "GET" && /\/entries\/[^/?]+$/.test(path)) return load ?? current;
		return undefined;
	};
};

const screen =
	(api: () => FakeApi, entryId = "entry-1") =>
	() => (
		<PageFrame api={api()} pathname={`/admin/entries/${entryId}/edit`}>
			<EntryEditorShell mode="edit" initialEntryId={entryId} adminId="u1" />
		</PageFrame>
	);

/** A plugin's spell-check cell with two findings, as a plugin fills the slot. It checks Korean only, so it leaves the cell out of any other language. */
const SpellingCell = () =>
	useStatusBarContext().locale !== "ko" ? null : (
		<StatusBarPluginCell
			label="맞춤법"
			findings={[
				{
					id: "1",
					title: "몇일 → 며칠",
					detail: "문단 1 · 몇일 동안 도구만 고쳤다",
					actionLabel: "고치기",
					onAction: () => {},
				},
				{
					id: "2",
					title: "안되요 → 안 돼요",
					detail: "문단 3 · 그래서 안되요",
					actionLabel: "고치기",
					onAction: () => {},
				},
			]}
			settings={{ label: "설정", href: "/admin/api-keys" }}
			fixAll={{ label: "모두 고치기", onClick: () => {} }}
		/>
	);
const screenWith =
	(api: () => FakeApi, entryId = "entry-1") =>
	() => (
		<PageFrame api={api()} pathname={`/admin/entries/${entryId}/edit`}>
			<StatusCellsProvider cells={{ spelling: SpellingCell }}>
				<EntryEditorShell mode="edit" initialEntryId={entryId} adminId="u1" />
			</StatusCellsProvider>
		</PageFrame>
	);

/** The editor mounts slowly in Storybook: every wait in a play function gets the long timeout. */
const LONG = { timeout: 10000 };
const page = (canvasElement: HTMLElement) => within(canvasElement);
const title = (canvasElement: HTMLElement) => page(canvasElement).findByRole("textbox", { name: "제목" }, LONG);
/** The header's "more" button: the toolbar has one of the same name, below the header. */
const headerMore = async (canvasElement: HTMLElement) => {
	const buttons = await page(canvasElement).findAllByRole("button", { name: "더보기" }, LONG);
	return buttons[0] as HTMLElement;
};
/** Waits until the editor has settled: the body is mounted and the status bar says the server has it.
 * The editor tidies the loaded body once after it mounts; an edit typed before that is lost from the save state, so the wait is generous. */
const settled = async (canvasElement: HTMLElement) => {
	await page(canvasElement).findAllByText(/저장됨/, undefined, { timeout: 10000 });
	await waitFor(() => expect(canvasElement.querySelector(".ProseMirror")).toBeTruthy(), { timeout: 10000 });
	await new Promise((resolve) => setTimeout(resolve, 3000));
};
const typeTitle = async (canvasElement: HTMLElement, text = " (고침)") => {
	await settled(canvasElement);
	const input = (await title(canvasElement)) as HTMLInputElement;
	fireEvent.change(input, { target: { value: input.value + text } });
	await page(canvasElement).findByRole("button", { name: "저장" }, LONG);
};

export const DraftLoaded: Story = { render: screen(() => server()) };

export const PublishedLoaded: Story = { render: screen(() => server({ entry: published })) };

export const Loading: Story = { render: screen(() => server({ load: "pending" })) };

export const LoadFailed: Story = {
	render: screen(() => server({ load: answer(500, { error: { message: "글을 불러오지 못했어요." } }) })),
};

export const NotFound: Story = {
	render: screen(() => server({ load: answer(404, { error: { code: "not_found", message: "Not found" } }) })),
};

export const UnsavedChanges: Story = {
	tags: ["visual"],
	render: screen(() => server()),
	play: async ({ canvasElement }) => {
		await typeTitle(canvasElement);
		await page(canvasElement).findByRole("button", { name: "저장" }, LONG);
	},
};

export const SaveFailed: Story = {
	render: screen(() => server({ save: answer(500, { error: { message: "서버에 저장하지 못했어요." } }) })),
	play: async ({ canvasElement }) => {
		await typeTitle(canvasElement);
		await userEvent.click(await page(canvasElement).findByRole("button", { name: "저장" }, LONG));
	},
};

/** Someone else saved version 9 first: the conflict dialog compares both sides. */
export const SaveConflict: Story = {
	render: screen(() =>
		server({
			save: answer(409, { error: { code: "conflict", serverVersion: 9 } }),
			// The first answer is the loaded entry, later ones the newer version.
			more: (() => {
				let loads = 0;
				return (path, method) =>
					method === "GET" && /\/entries\/[^/?]+$/.test(path) && ++loads > 1
						? {
								...draft,
								version: 9,
								changedAt: "2026-10-20T05:06:00.000Z",
								changedBy: "박미나",
								working: { ...draft.working, metadata: { ...draft.working.metadata, title: "서버 최신 제목" } },
							}
						: undefined;
			})(),
		}),
	),
	play: async ({ canvasElement }) => {
		await typeTitle(canvasElement);
		await userEvent.click(await page(canvasElement).findByRole("button", { name: "저장" }, LONG));
		await within(document.body).findByRole("dialog", undefined, LONG);
	},
};

export const PublishMenuOpen: Story = {
	render: screen(() => server({ entry: published })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await page(canvasElement).findByRole("button", { name: "발행 방식" }, LONG));
		await within(document.body).findByText(/오늘 날짜로 다시 발행/, undefined, LONG);
	},
};

export const MoreMenuOpen: Story = {
	render: screen(() => server()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await headerMore(canvasElement));
		await within(document.body).findByText(/^휴지통으로 이동$/, undefined, LONG);
	},
};

/** The publish check finds missing required fields: the status bar counts them. */
export const PublishNotReady: Story = {
	tags: ["visual"],
	render: screen(() => server({ issues: [missingTitle, missingSummary] })),
	play: async ({ canvasElement }) => {
		await page(canvasElement).findByRole("button", { name: /^할 일 2/ }, LONG);
	},
};

export const PublishReadinessOpen: Story = {
	tags: ["visual"],
	render: screen(() => server({ issues: [missingTitle, missingSummary] })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await page(canvasElement).findByRole("button", { name: /^할 일 2/ }, LONG));
		await within(document.body).findByRole("dialog", undefined, LONG);
	},
};

/** Publishing is refused by the server: the to-do list opens by itself. */
export const PublishBlocked: Story = {
	tags: ["visual"],
	render: screen(() =>
		server({
			issues: [],
			publish: answer(422, { error: { code: "publish_validation_failed", issues: [missingTitle, missingSummary] } }),
		}),
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(await page(canvasElement).findByRole("button", { name: "발행" }, LONG));
		await within(document.body).findByRole("dialog", undefined, LONG);
	},
};

/** A spell-check plugin fills the status bar's plugin cell with its findings; its list opens from the cell. */
export const PluginCellOpen: Story = {
	tags: ["visual"],
	render: screenWith(() => server({ entry: withTranslations })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await page(canvasElement).findByRole("button", { name: /^맞춤법 2/ }, LONG));
		await within(document.body).findByRole("dialog", undefined, LONG);
	},
};

/** The same cell in the translation editor, for a language the spell check covers (a Korean translation of an English original). */
export const PluginCellInTranslation: Story = {
	tags: ["visual"],
	render: screenWith(
		() =>
			server({
				entry: koTranslation,
				more: (path, method) => (method === "GET" && path.endsWith("/entry-ko") ? koTranslation : undefined),
			}),
		"entry-ko",
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(await page(canvasElement).findByRole("button", { name: /^맞춤법 2/ }, LONG));
		await within(document.body).findByRole("dialog", undefined, LONG);
	},
};

/** An English translation: the spell check does not cover English, so the plugin leaves its cell out and the bar has only the core cells. */
export const PluginCellLeftOut: Story = {
	tags: ["visual"],
	render: screenWith(
		() =>
			server({
				entry: translation,
				more: (path, method) => (method === "GET" && path.endsWith("/entry-en") ? translation : undefined),
			}),
		"entry-en",
	),
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		await expect(page(canvasElement).queryByRole("button", { name: /맞춤법/ })).toBeNull();
	},
};

export const PublishFailed: Story = {
	render: screen(() => server({ publish: answer(500, { error: { message: "발행하지 못했어요." } }) })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await page(canvasElement).findByRole("button", { name: "발행" }, LONG));
	},
};

export const SidePanelClosed: Story = {
	render: screen(() => server()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await page(canvasElement).findByRole("button", { name: "속성" }, LONG));
	},
};

export const TranslationTabs: Story = {
	render: screen(() => server({ entry: withTranslations })),
};

export const TranslationEditing: Story = {
	render: screen(
		() =>
			server({
				entry: translation,
				more: (path, method) => (method === "GET" && path.endsWith("/entry-en") ? translation : undefined),
			}),
		"entry-en",
	),
};

export const DeleteConfirm: Story = {
	render: screen(() => server()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await headerMore(canvasElement));
		await userEvent.click(await within(document.body).findByText(/^휴지통으로 이동$/, undefined, LONG));
		await within(document.body).findByRole("alertdialog", { hidden: true }, LONG);
	},
};

export const ArchiveConfirm: Story = {
	render: screen(() => server({ entry: published })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await headerMore(canvasElement));
		await userEvent.click(await within(document.body).findByText(/^보관$/, undefined, LONG));
		await within(document.body).findByRole("alertdialog", { hidden: true }, LONG);
	},
};

/** Flow 5 · 18: a trashed entry opens read-only, with the days it has left and only restore and the permanent delete in the head. */
const trashedDraft = {
	...draft,
	status: "trashed" as const,
	trashedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
};

export const TrashedEntry: Story = {
	tags: ["visual"],
	render: screen(() => server({ entry: trashedDraft })),
};

export const PermanentDeleteConfirm: Story = {
	render: screen(() => server({ entry: trashedDraft })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /^영구/ }, LONG));
		await within(document.body).findByRole("alertdialog", { hidden: true }, LONG);
	},
};

export const ImageInsertDialog: Story = {
	render: screen(() => server()),
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		// The upload menu sits in the toolbar when there is room, and in its "more" menu when the frame is narrow.
		const toolbar = within(await page(canvasElement).findByRole("toolbar", undefined, LONG));
		const upload = toolbar.queryByRole("button", { name: "업로드" });
		if (upload) await userEvent.click(upload);
		else {
			await userEvent.click(toolbar.getByRole("button", { name: "더보기" }));
		}
		await userEvent.click(await within(document.body).findByText("이미지", undefined, { timeout: 15000 }));
		await within(document.body).findByRole("dialog", undefined, LONG);
	},
};

/** A copy of an unsaved edit is waiting in the browser: the editor offers to bring it back. */
export const RecoveryOffer: Story = {
	loaders: [
		async () => {
			const base = formFromEntry(testSite, draft);
			const snapshot = { ...base, title: "저장하지 못한 제목" } as EntryForm;
			await saveLocalBackup(
				{
					key: "u1:entry-1",
					entryId: "entry-1",
					baseVersion: draft.version,
					baseFingerprint: formFingerprint(testSite, base),
					localFingerprint: formFingerprint(testSite, snapshot),
					snapshot,
					changeSeq: 1,
					savedAt: Date.parse("2026-10-21T14:20:00.000Z"),
				},
				testSite,
			);
		},
	],
	render: screen(() => server()),
	play: async () => {
		await within(document.body).findByRole("dialog", undefined, LONG);
	},
};
