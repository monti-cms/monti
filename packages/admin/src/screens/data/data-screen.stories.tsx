import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { ImportPreview, ImportRun } from "../../api/import";
import type { RestoreCounts, RestorePreview, RestoreRun } from "../../api/restore";
import { answer, type FakeApi, PageFrame } from "../../stories/screen-frame";
import { DataScreen } from "./data-screen";

const meta = { title: "Screens/Data", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const summary = {
	scope: "admin",
	entries: 128,
	addedByTranslations: 0,
	notPublished: 0,
	notFound: 0,
	templates: 4,
	folders: 6,
	addresses: 131,
	media: 42,
};

const restoreCounts: RestoreCounts = {
	entries: 6,
	byStatus: { draft: 2, published: 2, archived: 1, trashed: 1 },
	translations: 1,
	folders: 3,
	media: 1,
	addresses: 5,
	aliases: 1,
	templatesAdded: 1,
	templatesSkipped: [
		{ id: "t1", name: "빈 템플릿", reason: "id", text: "A template with this id is already on the site." },
	],
};
const notRestored = [
	{ code: "preferences", count: null, text: "Admin preferences. They belong to users." },
	{ code: "event_logs", count: null, text: "Event logs. Plugins are not notified." },
];
const restorePreview: RestorePreview = {
	mode: "preview",
	ready: true,
	isBackup: true,
	refusal: null,
	empty: true,
	counts: restoreCounts,
	problems: [],
	warnings: [
		{ code: "media_file_missing", id: "m1", label: "photo.png", text: "The file is not in this site's storage." },
	],
	notRestored,
};
const restoreRun: RestoreRun = {
	mode: "run",
	counts: restoreCounts,
	warnings: restorePreview.warnings,
	notRestored,
};

const reason = (code: string, text: string) => ({ code, text });
const entry = (
	key: string,
	title: string,
	slug: string,
	skipped: ImportPreview["entries"][number]["skipped"] = null,
) => ({
	key,
	collection: "memo",
	target: "memo",
	title,
	slug,
	locale: "ko",
	isTranslation: false,
	body: { kind: "text" as const, format: "mdx" },
	published: true,
	outsideImages: 0,
	keptLinks: 0,
	skipped,
	notes: [],
});
const importPreview: ImportPreview = {
	mode: "preview",
	kind: "export",
	collections: [
		{ name: "memo", entries: 3, target: "memo", skipped: null },
		{ name: "tag", entries: 1, target: null, skipped: reason("item_collection", "tag is an item collection.") },
	],
	targets: [
		{ name: "post", label: "글" },
		{ name: "memo", label: "메모" },
	],
	entries: [
		entry("a", "첫 번째 메모", "first"),
		entry(
			"b",
			"두 번째 메모",
			"second",
			reason("slug_exists", "An entry with the address second already exists here."),
		),
		entry("c", "세 번째 메모", "third"),
	],
	fieldsNotImported: [{ collection: "memo", target: "memo", fields: ["tagIds", "seoTitle"], required: [] }],
	counts: {
		entries: 4,
		imported: 2,
		skipped: 2,
		conflicts: 1,
		publishable: 2,
		outsideImages: 0,
		keptLinks: 0,
		otherFiles: 0,
	},
};
const step = { status: "done" as const };
const result = (key: string, title: string, slug: string, outcome: "imported" | "skipped") => ({
	key,
	collection: "memo",
	target: "memo",
	locale: "ko",
	title,
	slug,
	id: outcome === "imported" ? `id-${key}` : null,
	outcome,
	create:
		outcome === "imported"
			? step
			: { status: "skipped" as const, reason: reason("slug_exists", "The address is taken.") },
	body: outcome === "imported" ? step : null,
	publish: null,
	warnings: [],
	notes: [],
});
const importRun: ImportRun = {
	mode: "run",
	results: [result("a", "첫 번째 메모", "first", "imported"), result("b", "두 번째 메모", "second", "skipped")],
	counts: { imported: 1, draft: 0, skipped: 1, failed: 0, published: 0 },
};

/** Answers every read the Data page makes; `over` replaces single routes (exact path → answer). */
const serve =
	(over: Record<string, (method: string) => unknown> = {}): FakeApi =>
	(path, method) => {
		for (const [prefix, respond] of Object.entries(over)) if (path.split("?")[0] === prefix) return respond(method);
		if (path.startsWith("/api/monti/v1/meta"))
			return { formats: [{ name: "mdx", label: "MDX", extension: "mdx" }], limits: {} };
		if (path.startsWith("/api/monti/v1/export/summary")) return summary;
		if (path.startsWith("/api/monti/v1/import/restore")) return { empty: true, entries: 0, folders: 0, media: 0 };
		if (path.startsWith("/api/monti/v1/folders")) return [];
		if (path.startsWith("/api/monti/v1/entries")) return { items: [], total: 0 };
		return undefined;
	};

/** A route whose first POST is the preview and later POSTs are the run (the server tells them apart by the form's `mode`). */
const previewThenRun = (preview: unknown, run: () => unknown) => {
	let posts = 0;
	return (method: string) => (method === "POST" ? (posts++ === 0 ? preview : run()) : undefined);
};

const screen = (api: FakeApi) => () => (
	<PageFrame api={api} pathname="/admin/data">
		<DataScreen />
	</PageFrame>
);

const zip = (name: string) => new File(["zip"], name, { type: "application/zip" });
const chooseFile = async (canvasElement: HTMLElement, testId: string, name: string) => {
	const input = await within(canvasElement).findByTestId(testId);
	await userEvent.upload(input, zip(name));
};

export const Loaded: Story = { render: screen(serve()) };

/** The site backup is still counting what it would hold. */
export const Counting: Story = {
	render: screen(serve({ "/api/monti/v1/export/summary": () => "pending" })),
};

export const CountFailed: Story = {
	render: screen(
		serve({ "/api/monti/v1/export/summary": () => answer(500, { error: { message: "Could not count." } }) }),
	),
};

/** The archive is being built on the server. */
export const ExportRunning: Story = {
	render: screen(serve({ "/api/monti/v1/export": (method) => (method === "POST" ? "pending" : undefined) })),
	play: async ({ canvasElement }) => {
		const c = within(canvasElement);
		const button = await c.findByRole("button", { name: "전체 내보내기" });
		await waitFor(() => expect(button).toBeEnabled());
		await userEvent.click(button);
	},
};

export const ImportPreviewShown: Story = {
	render: screen(serve({ "/api/monti/v1/import/entries": previewThenRun(importPreview, () => importRun) })),
	play: async ({ canvasElement }) => {
		await chooseFile(canvasElement, "import-file", "memos.zip");
		await within(canvasElement).findByRole("button", { name: "가져오기" });
	},
};

export const ImportPreviewFailed: Story = {
	render: screen(
		serve({ "/api/monti/v1/import/entries": () => answer(422, { error: { message: "This is not a readable zip." } }) }),
	),
	play: async ({ canvasElement }) => {
		await chooseFile(canvasElement, "import-file", "broken.zip");
	},
};

export const ImportRunning: Story = {
	render: screen(serve({ "/api/monti/v1/import/entries": previewThenRun(importPreview, () => "pending") })),
	play: async ({ canvasElement }) => {
		await chooseFile(canvasElement, "import-file", "memos.zip");
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "가져오기" }));
	},
};

export const ImportResult: Story = {
	render: screen(serve({ "/api/monti/v1/import/entries": previewThenRun(importPreview, () => importRun) })),
	play: async ({ canvasElement }) => {
		await chooseFile(canvasElement, "import-file", "memos.zip");
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "가져오기" }));
		await within(canvasElement).findByRole("button", { name: "다른 파일 가져오기" });
	},
};

export const ImportFailed: Story = {
	render: screen(
		serve({
			"/api/monti/v1/import/entries": previewThenRun(importPreview, () =>
				answer(500, { error: { message: "The import stopped halfway." } }),
			),
		}),
	),
	play: async ({ canvasElement }) => {
		await chooseFile(canvasElement, "import-file", "memos.zip");
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "가져오기" }));
	},
};

/** The site already holds content, so a backup cannot be restored. */
export const RestoreNotEmpty: Story = {
	render: screen(
		serve({ "/api/monti/v1/import/restore": () => ({ empty: false, entries: 12, folders: 2, media: 5 }) }),
	),
};

export const RestorePreviewShown: Story = {
	render: screen(
		serve({
			"/api/monti/v1/import/restore": (method) =>
				method === "POST" ? restorePreview : { empty: true, entries: 0, folders: 0, media: 0 },
		}),
	),
	play: async ({ canvasElement }) => {
		await chooseFile(canvasElement, "restore-file", "backup.zip");
		await within(canvasElement).findByTestId("restore-run");
	},
};

/** The chosen file is not a backup, or the backup has problems. */
export const RestoreProblems: Story = {
	render: screen(
		serve({
			"/api/monti/v1/import/restore": (method) =>
				method === "POST"
					? {
							...restorePreview,
							ready: false,
							problems: [
								{
									subject: "entry",
									id: "e1",
									label: "첫 번째 글",
									code: "missing_body",
									text: "The entry has no body.",
									found: ["body: missing"],
								},
							],
						}
					: { empty: true, entries: 0, folders: 0, media: 0 },
		}),
	),
	play: async ({ canvasElement }) => {
		await chooseFile(canvasElement, "restore-file", "backup.zip");
		await within(canvasElement).findByTestId("restore-problems");
	},
};

export const RestoreConfirm: Story = {
	render: screen(serve({ "/api/monti/v1/import/restore": previewThenRestoreState(restorePreview, () => restoreRun) })),
	play: async ({ canvasElement }) => {
		await chooseFile(canvasElement, "restore-file", "backup.zip");
		await userEvent.click(await within(canvasElement).findByTestId("restore-run"));
		await within(document.body).findByRole("alertdialog");
	},
};

export const RestoreFailed: Story = {
	render: screen(
		serve({
			"/api/monti/v1/import/restore": previewThenRestoreState(restorePreview, () =>
				answer(409, { error: { message: "A backup can only be restored into an empty site." } }),
			),
		}),
	),
	play: async ({ canvasElement }) => {
		await chooseFile(canvasElement, "restore-file", "backup.zip");
		await userEvent.click(await within(canvasElement).findByTestId("restore-run"));
		await userEvent.click(await within(document.body).findByRole("button", { name: "백업 복원하기" }));
		await within(canvasElement).findByTestId("restore-error");
	},
};

export const RestoreDone: Story = {
	render: screen(serve({ "/api/monti/v1/import/restore": previewThenRestoreState(restorePreview, () => restoreRun) })),
	play: async ({ canvasElement }) => {
		await chooseFile(canvasElement, "restore-file", "backup.zip");
		await userEvent.click(await within(canvasElement).findByTestId("restore-run"));
		await userEvent.click(await within(document.body).findByRole("button", { name: "백업 복원하기" }));
		await within(canvasElement).findByTestId("restore-result");
	},
};

/** The restore route: GET is the site's state, the first POST the preview, the next the run. */
function previewThenRestoreState(preview: unknown, run: () => unknown) {
	const post = previewThenRun(preview, run);
	return (method: string) => (method === "POST" ? post(method) : { empty: true, entries: 0, folders: 0, media: 0 });
}
