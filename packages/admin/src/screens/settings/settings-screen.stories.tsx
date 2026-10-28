import { toast } from "@monti-cms/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { testSite } from "../../../../core/test/site";
import { answer, type FakeApi, PageFrame } from "../../stories/screen-frame";
import { schemaCollectionMessages } from "../schema/collection.messages";
import { schemaFieldsMessages } from "../schema/fields.messages";
import { schemaLocalesMessages } from "../schema/locales.messages";
import { schemaMessages } from "../schema/messages";
import { SAVED_MESSAGE_KEY } from "../schema/reload";
import { schemaReviewMessages } from "../schema/review.messages";
import { SettingsScreen } from "./settings-screen";
import type { SchemaTab } from "./tabs";

const meta = { title: "Screens/Settings", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const t = testSite.createTranslator(schemaMessages);
const tCollection = testSite.createTranslator(schemaCollectionMessages);
const tFields = testSite.createTranslator(schemaFieldsMessages);
const tLocales = testSite.createTranslator(schemaLocalesMessages);
const tReview = testSite.createTranslator(schemaReviewMessages);

const SCHEMA = "/api/monti/v1/schema";

const schema = () => ({
	site: { name: "몬티 블로그" },
	collections: {
		post: {
			label: "글",
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", label: "제목", required: true },
				slug: { kind: "slug", label: "주소", from: "title" },
				summary: { kind: "text", label: "요약" },
				status: { kind: "select", label: "상태", options: { draft: "초안", live: "공개" }, defaultValue: "draft" },
			},
		},
		tag: { label: "태그", kind: "item", fields: { title: { kind: "text", label: "이름", required: true } } },
	},
	locales: [
		{ code: "ko", name: "한국어" },
		{ code: "en", name: "English" },
	],
	defaultLocale: "ko",
	admin: { messages: { ko: { "entries.title": "콘텐츠" } } },
});

const screenState = (over: Record<string, unknown> = {}) => ({
	access: { writable: true },
	file: "monti.schema.ts",
	hash: "hash-1",
	schema: schema(),
	source: "file",
	comments: false,
	issues: [],
	applied: { appliedAt: "2026-10-01T00:00:00.000Z" },
	codeCollections: [],
	vocabulary: { blocks: ["table", "image", "callout"], marks: ["bold", "italic"] },
	collections: ["post", "tag"],
	footprints: {},
	siteUrl: { url: null, from: "none" },
	...over,
});

const previewOf = (over: Record<string, unknown> = {}) => ({
	valid: true,
	issues: [],
	changed: true,
	impacts: [],
	decisions: [],
	transforms: [],
	problems: [],
	baseline: "applied",
	bodiesRead: 0,
	...over,
});

/** A preview that names one change touching stored entries. */
const previewWithImpact = () =>
	previewOf({
		impacts: [
			{
				change: {
					kind: "field_renamed",
					collection: "post",
					from: "summary",
					to: "excerpt",
					handledBy: "rename-summary",
				},
				key: "field_renamed:post:summary:summary:excerpt",
				entries: 3,
				sample: [
					{ id: "11111111-aaaa", collection: "post", locale: "ko", status: "published", title: "첫 번째 글" },
					{ id: "22222222-bbbb", collection: "post", locale: "ko", status: "draft", title: "두 번째 글" },
				],
				consequence: "transformed",
				checked: true,
			},
		],
		transforms: [{ id: "rename-summary", op: "renameField", collection: "post", from: "summary", to: "excerpt" }],
	});

/** The server: the schema file, the check of an edit, and what saving answers. */
const server =
	({
		state = screenState(),
		preview = previewOf(),
		save,
	}: {
		state?: unknown;
		preview?: unknown;
		save?: ReturnType<typeof answer>;
	} = {}): FakeApi =>
	(path, method) => {
		if (path === SCHEMA && method === "GET") return state;
		if (path === `${SCHEMA}/preview` && method === "POST") return preview;
		if (path === SCHEMA && method === "PUT")
			return save ?? { saved: true, file: "monti.schema.ts", hash: "hash-2", transforms: [] };
		return undefined;
	};

/**
 * The page keeps its tab and the open collection in the address of the frame; this sets them before the story renders, so one story does not leave its place to the next.
 * (Tabs are picked by the `tab` prop here: the tab links would move the Storybook frame itself.)
 */
const place =
	(query: Record<string, string> = {}) =>
	() => {
		const url = new URL(window.location.href);
		url.searchParams.delete("collection");
		url.searchParams.delete("section");
		for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
		window.history.replaceState(null, "", `${url.pathname}${url.search}`);
	};

const screen =
	(api: FakeApi, tab: SchemaTab = "collections") =>
	() => (
		<PageFrame api={api} pathname={`/admin/settings/${tab}`}>
			<SettingsScreen tab={tab} />
		</PageFrame>
	);

const story = (api: FakeApi, tab: SchemaTab, query?: Record<string, string>, extra: Partial<Story> = {}): Story => ({
	beforeEach: place(query),
	render: screen(api, tab),
	...extra,
});

/** Types into the label of the open collection, which makes the draft differ from the file. */
const editLabel = async (canvasElement: HTMLElement) => {
	const input = await within(canvasElement).findByLabelText(tCollection("collection.label"));
	// A change event, not typed keys: the input tracks its value for React, and typing does not reach it here.
	fireEvent.change(input, { target: { value: `${(input as HTMLInputElement).value} 2` } });
};

/** Edits the draft, opens the review dialog and, when asked, presses its save. */
const review =
	(save: boolean) =>
	async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		await editLabel(canvasElement);
		await userEvent.click(
			await within(canvasElement).findByRole("button", { name: new RegExp(`^${t("bar.review")}`) }),
		);
		if (!save) return;
		const dialog = await within(document.body).findByRole("dialog");
		const button = await within(dialog).findByRole("button", { name: tReview("review.save") });
		await waitFor(() => expect(button).toBeEnabled());
		await userEvent.click(button);
	};

// Each tab, loaded. The site tab (the readable width) and the fields tab (the full width) are shot: no unit test can check a layout.
export const SiteTab = story(server(), "site", undefined, { tags: ["visual"] });
export const LocalesTab = story(server(), "locales");
export const CollectionsBasics = story(server(), "collections", { collection: "post" });
export const CollectionsFields = story(
	server(),
	"collections",
	{ collection: "post", section: "fields" },
	{ tags: ["visual"] },
);
export const CollectionsEditor = story(server(), "collections", { collection: "post", section: "editor" });
export const AdminTab = story(server(), "admin");

// Loading and failing to load.
export const Loading = story(() => "pending", "collections");
export const LoadFailed = story(() => answer(500), "collections");

// Unsaved changes: the marks on the tab and in the collection list, and the save group in the title row.
export const UnsavedChanges = story(
	server(),
	"collections",
	{ collection: "post" },
	{
		tags: ["visual"],
		play: async ({ canvasElement }) => editLabel(canvasElement),
	},
);
export const ReviewDialog = story(
	server({ preview: previewWithImpact() }),
	"collections",
	{ collection: "post" },
	{
		play: review(false),
	},
);
export const ReviewChecking = story(
	server({ preview: "pending" as never }),
	"collections",
	{ collection: "post" },
	{
		play: review(false),
	},
);
export const ReviewFailed = story(
	(path, method) => (path === `${SCHEMA}/preview` && method === "POST" ? answer(500) : server()(path, method)),
	"collections",
	{ collection: "post" },
	{ play: review(false) },
);
export const SaveFailed = story(
	server({
		preview: previewWithImpact(),
		save: answer(400, { error: { code: "invalid_schema", message: "The schema did not pass the check." } }),
	}),
	"collections",
	{ collection: "post" },
	{ play: review(true) },
);
export const SaveConflict = story(
	server({
		save: answer(409, { error: { code: "schema_conflict", message: "The file changed." } }),
	}),
	"collections",
	{ collection: "post" },
	{ play: review(true) },
);

// Deleting a collection with its entries: Flow 4 of the canvas, steps 15 to 19 (the Schema board's stages 지우기 전, 지울 예정, 지우기 검토, 지운 뒤).
const memoSchema = () => {
	const base = schema();
	return {
		...base,
		collections: {
			post: base.collections.post,
			memo: {
				label: "메모",
				kind: "document",
				path: "/memos/:slug",
				fields: {
					title: { kind: "text", label: "제목", required: true },
					slug: { kind: "slug", label: "주소", from: "title" },
				},
			},
			tag: base.collections.tag,
		},
	};
};
const memoState = (over: Record<string, unknown> = {}) =>
	screenState({
		schema: memoSchema(),
		collections: ["post", "memo", "tag"],
		footprints: {
			post: { entries: 148, trashed: 0, folders: 3 },
			memo: { entries: 23, trashed: 2, folders: 2 },
			tag: { entries: 12, trashed: 0, folders: 0 },
		},
		...over,
	});
const memoRemoval = {
	change: { kind: "collection_removed", collection: "memo", handledBy: "drop-memo" },
	key: "collection_removed:memo",
	entries: 23,
	sample: [],
	consequence: "deleted",
	checked: true,
	drop: {
		entries: 23,
		trashed: 2,
		translations: 0,
		folders: 2,
		addresses: 31,
		unlinked: {
			count: 4,
			sample: [{ id: "11111111-aaaa", collection: "post", locale: "ko", status: "published", title: "첫 번째 글" }],
		},
		bodyLinks: 2,
	},
};
/** The server of the delete: the review names what goes and the four entries whose links are cut when it is applied. */
const deleteServer: FakeApi = (path, method) => {
	if (path === SCHEMA && method === "GET") return memoState();
	if (path === `${SCHEMA}/preview`)
		return previewOf({
			impacts: [memoRemoval],
			transforms: [{ id: "drop-memo", op: "dropCollection", collection: "memo" }],
		});
	return undefined;
};
const pressDelete = async (canvasElement: HTMLElement) => {
	const block = await within(canvasElement).findByTestId("collection-delete");
	await userEvent.click(within(block).getByRole("button", { name: tCollection("collection.delete") }));
};
/** Board stage 지우기 전 (step 15): the block at the bottom of the basics tab. */
export const CollectionDeleteBefore = story(deleteServer, "collections", { collection: "memo" }, { tags: ["visual"] });
/** Board stage 지울 예정 (step 16): gone from the list at once, the editor on the first one left, the changes menu open with the row, and the toast. */
export const CollectionDeleteRemoved = story(
	deleteServer,
	"collections",
	{ collection: "memo" },
	{
		tags: ["visual"],
		play: async ({ canvasElement }) => {
			await pressDelete(canvasElement);
			await userEvent.click(await within(canvasElement).findByRole("button", { name: t("bar.list") }));
			await within(document.body).findByRole("menuitem", { name: new RegExp(t("bar.removed")) });
		},
	},
);
/** Board stage 지우기 검토 (step 17): the review names what goes, what is cut and what breaks; 지우고 적용 is on from the start. */
export const CollectionDeleteReview = story(
	deleteServer,
	"collections",
	{ collection: "memo" },
	{
		tags: ["visual"],
		play: async ({ canvasElement }) => {
			await pressDelete(canvasElement);
			// The board's review has no toast: it belongs to the moment of the press.
			toast.dismiss();
			await userEvent.click(await within(canvasElement).findByRole("button", { name: t("bar.save") }));
			const sheet = await within(document.body).findByRole("dialog");
			await within(sheet).findByTestId("impact-collection_removed:memo");
		},
	},
);
/** Board stage 지운 뒤 (step 19): the collection is gone from the list, and the toast says what went. */
export const CollectionDeleted = story(
	(path, method) => {
		if (path === SCHEMA && method === "GET") {
			const base = memoState();
			const { memo: _memo, ...collections } = (base.schema as ReturnType<typeof memoSchema>).collections;
			return { ...base, schema: { ...base.schema, collections }, collections: ["post", "tag"] };
		}
		return undefined;
	},
	"collections",
	{ collection: "post" },
	{
		tags: ["visual"],
		beforeEach: () => {
			window.sessionStorage.setItem(SAVED_MESSAGE_KEY, t("save.done"));
		},
	},
);

// Dialogs and sheets.
export const AddFieldDialog = story(
	server(),
	"collections",
	{ collection: "post", section: "fields" },
	{
		play: async ({ canvasElement }) => {
			await userEvent.click(await within(canvasElement).findByRole("button", { name: tFields("field.add") }));
		},
	},
);
export const FieldEditorOpen = story(
	server(),
	"collections",
	{ collection: "post", section: "fields" },
	{
		play: async ({ canvasElement }) => {
			await userEvent.click(
				await within(canvasElement).findByRole("button", { name: tFields("field.toggle", { name: "status" }) }),
			);
		},
	},
);
export const NewCollectionDialog = story(
	server(),
	"collections",
	{ collection: "post" },
	{
		play: async ({ canvasElement }) => {
			await userEvent.click(await within(canvasElement).findByRole("button", { name: t("collection.create") }));
		},
	},
);
export const AddLocaleDialog = story(server(), "locales", undefined, {
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: tLocales("locales.add") }));
	},
});
export const DiscardConfirm = story(
	server(),
	"collections",
	{ collection: "post" },
	{
		play: async ({ canvasElement }) => {
			await editLabel(canvasElement);
			await userEvent.click(await within(canvasElement).findByRole("button", { name: t("bar.discard") }));
		},
	},
);

// The file cannot be edited here.
export const ReadOnlyNotWritable = story(
	server({ state: screenState({ access: { writable: false, reason: "not_writable" } }) }),
	"collections",
	{ collection: "post" },
);
export const ReadOnlyProduction = story(
	server({ state: screenState({ access: { writable: false, reason: "production" } }) }),
	"site",
);
export const ReadOnlyNoFile = story(
	server({ state: screenState({ access: { writable: false, reason: "no_schema_file" }, file: null, hash: null }) }),
	"collections",
);
export const ReadOnlyHasCode = story(
	server({
		state: screenState({
			access: { writable: false, reason: "has_code", detail: "line 12: a function call `env(...)`" },
		}),
	}),
	"collections",
);

// The file itself has a problem.
export const FileInvalid = story(
	server({
		state: screenState({
			hash: null,
			issues: [
				{
					path: "collections.post.fields.slug.from",
					message: "refers to a field that does not exist",
					code: "unknown-field",
				},
			],
		}),
	}),
	"collections",
);
export const FileHasComments = story(server({ state: screenState({ comments: true }) }), "site");
export const CodeCollections = story(server({ state: screenState({ codeCollections: ["page"] }) }), "collections", {
	collection: "post",
});
