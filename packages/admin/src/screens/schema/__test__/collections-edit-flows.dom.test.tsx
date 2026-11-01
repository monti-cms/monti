import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { SavedSchema, SchemaEditPreview, SchemaScreenState, SuggestedTransform } from "../../../api/schema";
import { commonMessages } from "../../../lib/common.messages";
import { type FakeApi, failure, fakeApi } from "../../../test/fake-api";
import { createTestRouter } from "../../../test/router";
import { toast } from "../../../test/ui-toast";
import { AdminQueryProvider } from "../../shared/query-provider";
import { schemaChangesMessages } from "../changes.messages";
import { schemaFieldsMessages } from "../fields.messages";
import { schemaLocalesMessages } from "../locales.messages";
import { schemaMessages } from "../messages";
import { schemaProblemMessages } from "../problems.messages";
import { rememberSaved } from "../reload";
import { schemaReviewMessages } from "../review.messages";
import { ReviewDialog } from "../review-dialog";
import { SchemaSettings } from "../schema-screen";

// Flow 4 of the canvas, the rows "필드 고치기" (steps 07-12), "주소 바꾸기" (steps 13-14) and "새 컬렉션" (steps 05-06), and flow 11 step 08 (a language
// taken out): the changes list, the preview panel, and the review sheet with its choices. A screenshot cannot see which requests a choice sends, which button is
// on, what the name of a control is, or what the reload carries to the next page; this file checks those. How it all looks is the visual stories' job.

const nav = createTestRouter();
const { render } = nav;
const t = testSite.createTranslator(schemaMessages);
const tFields = testSite.createTranslator(schemaFieldsMessages);
const tReview = testSite.createTranslator(schemaReviewMessages);
const tProblem = testSite.createTranslator(schemaProblemMessages);
const tLocales = testSite.createTranslator(schemaLocalesMessages);
const tChanges = testSite.createTranslator(schemaChangesMessages);
const tc = testSite.createTranslator(commonMessages);

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);
// Only the browser's reload is replaced (jsdom cannot reload a page; `reload.ts` keeps it in a function of its own for this). The line a save leaves for the
// next page goes through the real session storage.
const reload = vi.hoisted(() => ({ reloadPage: vi.fn() }));
vi.mock("../reload", async (importOriginal) => ({
	...(await importOriginal<typeof import("../reload")>()),
	...reload,
}));

const field = (label: string, extra: object = {}) => ({ kind: "text", label, ...extra });
/** The label of the lede field, which names the first choice of the review. */
const LEDE_LABEL = "요약";
const story = (fields: Record<string, unknown>) => ({
	label: "게시글",
	kind: "document",
	path: "/stories/:slug",
	fields: {
		title: field("제목", { required: true }),
		slug: { kind: "slug", label: "주소", from: "title" },
		...fields,
	},
});

const stateOf = (
	collections: Record<string, unknown>,
	locales: unknown[] = [{ code: "de", name: "Deutsch" }],
): SchemaScreenState => ({
	access: { writable: true },
	file: "monti.schema.ts",
	hash: "hash-1",
	schema: { collections, locales, defaultLocale: "de" },
	source: "file",
	comments: false,
	issues: [],
	applied: { appliedAt: "2026-01-01T00:00:00.000Z" },
	codeCollections: [],
	vocabulary: { blocks: [], marks: [] },
	collections: Object.keys(collections),
	footprints: Object.fromEntries(
		Object.keys(collections).map((name) => [name, { entries: 148, trashed: 0, folders: 3 }]),
	),
	siteUrl: { url: null, from: "none" },
});

type Impact = SchemaEditPreview["impacts"][number];
type Decision = SchemaEditPreview["decisions"][number];

const sample: Impact["sample"] = [
	{ id: "e-1", title: "첫 번째 글", collection: "story", locale: "de", status: "published" },
	{ id: "e-2", title: "발행 후 고친 글", collection: "story", locale: "de", status: "published" },
];
const preview = (over: Partial<SchemaEditPreview> = {}): SchemaEditPreview => ({
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

let api: FakeApi;
let state: SchemaScreenState;
let previewOf: () => SchemaEditPreview;
let saved: SavedSchema;

beforeEach(() => {
	vi.clearAllMocks();
	window.sessionStorage.clear();
	previewOf = () => preview();
	saved = {
		saved: true,
		file: "monti.schema.ts",
		hash: "hash-2",
		transforms: [],
		entriesRewritten: 0,
		reloaded: true,
		conflicts: 0,
		dropped: [],
		trashed: [],
	};
	api = fakeApi()
		.on("GET /v1/schema", () => state)
		.on("POST /v1/schema/preview", () => previewOf())
		.on("PUT /v1/schema", () => saved)
		.install();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const lastPreview = () => api.sent("POST /v1/schema/preview").at(-1);
const put = () => api.sent("PUT /v1/schema")[0];
const names = (buttons: HTMLElement[]) => buttons.map((button) => button.textContent);

const open = (tab: "collections" | "locales" = "collections") =>
	render(
		<AdminQueryProvider>
			<SchemaSettings tab={tab} />
		</AdminQueryProvider>,
	);
const openFields = () => {
	window.history.replaceState(null, "", "/admin/settings/collections?collection=story&section=fields");
	return open();
};
/** Removes a field of the open collection from its row. */
const removeField = async (name: string) =>
	fireEvent.click(await screen.findByRole("button", { name: t("row.remove", { name }) }));
/** Opens the preview panel of the open collection if it is not open (it starts open on a wide window). */
const openPreview = async () => {
	const toggle = await screen.findByRole("button", { name: tFields("layout.previewTitle") });
	if (toggle.getAttribute("aria-pressed") !== "true") fireEvent.click(toggle);
	return screen.findByRole("complementary", { name: tProblem("preview.label") });
};
const bar = () => screen.getByRole("region", { name: t("bar.label") });
/** The rows of the open collection's field list. */
const fieldRows = () => within(screen.getByRole("list", { name: tFields("field.title") })).getAllByRole("listitem");
/** The row of a field: the one with the button that opens it. */
const fieldRow = (name: string) => {
	const row = fieldRows().find((item) =>
		within(item).queryByRole("button", { name: tFields("field.toggle", { name }) }),
	);
	if (!row) throw new Error(`no row for the field ${name}`);
	return row;
};
/** The row a removed field leaves in its place: its name, and nothing to press. */
const goneRow = (name: string) =>
	fieldRows().find((item) => within(item).queryByText(name) && within(item).queryAllByRole("button").length === 0);
const saveButton = () => within(bar()).getByRole("button", { name: t("bar.save") }) as HTMLButtonElement;

describe("flow 4 · 필드 고치기 — 바뀐 곳, 미리보기, 고칠 곳 (steps 07-10)", () => {
	beforeEach(() => {
		state = stateOf({
			story: story({
				lede: field("요약"),
				subtitle: field("부제"),
				extra: field("덧말"),
				format: { kind: "select", label: "글 종류", options: { note: "메모", essay: "에세이" } },
			}),
		});
	});

	it("SCHEMA-F8 07 counts every changed field, 10 lists them with one undo each and takes one back", async () => {
		openFields();
		await removeField("subtitle");
		await removeField("lede");
		await removeField("extra");
		expect(within(bar()).getByLabelText(t("bar.count", { count: 3 }))).toBeInTheDocument();

		fireEvent.click(within(bar()).getByRole("button", { name: t("bar.list") }));
		const rows = await screen.findAllByRole("menuitem");
		expect(rows).toHaveLength(3);
		for (const row of rows) expect(row.textContent).toContain(t("bar.undo"));
		expect(rows.map((row) => row.textContent).join(" ")).toContain(tChanges("tag.removed"));

		// A change is named for its field's label: 요약 is the lede.
		fireEvent.click(screen.getByRole("menuitem", { name: /^요약/ }));
		await waitFor(() => expect(within(bar()).getByLabelText(t("bar.count", { count: 2 }))).toBeInTheDocument());
		expect(fieldRow("lede").textContent).not.toContain(tChanges("tag.removed"));
	});

	it("SCHEMA-F8 07 marks a rename with its old name, a removed field struck in its place and a new field, and takes each back from the list", async () => {
		openFields();
		// A rename: the name is taken from the field's sheet on Save.
		fireEvent.click(await screen.findByRole("button", { name: tFields("field.toggle", { name: "lede" }) }));
		const sheet = await screen.findByRole("dialog");
		const nameBox = within(sheet).getByRole("textbox", { name: tFields("field.name") });
		fireEvent.change(nameBox, { target: { value: "excerpt" } });
		fireEvent.blur(nameBox);
		fireEvent.click(within(sheet).getByRole("button", { name: tFields("sheet.save") }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await removeField("subtitle");
		// A new field, from the sheet of kinds.
		fireEvent.click(await screen.findByRole("button", { name: `+ ${tFields("field.add")}` }));
		const adding = await screen.findByRole("dialog");
		fireEvent.change(within(adding).getByRole("textbox", { name: tFields("field.label") }), {
			target: { value: "Lead" },
		});
		fireEvent.click(within(adding).getByRole("button", { name: tFields("field.add") }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

		expect(within(bar()).getByLabelText(t("bar.count", { count: 3 }))).toBeInTheDocument();
		expect(fieldRow("excerpt").textContent).toContain("\u2190 lede");
		const gone = goneRow("subtitle") as HTMLElement;
		expect(gone.textContent).toContain(tChanges("tag.removed"));
		expect(fieldRow("lead").textContent).toContain(tChanges("tag.added"));

		// Each one is taken back from the list of changes: the row goes back to what it was.
		fireEvent.click(within(bar()).getByRole("button", { name: t("bar.list") }));
		const rows = await screen.findAllByRole("menuitem");
		const removal = rows.find((row) => row.textContent?.includes(tChanges("tag.removed")));
		fireEvent.click(removal as HTMLElement);
		await waitFor(() => expect(goneRow("subtitle")).toBeUndefined());
		expect(fieldRow("subtitle").textContent).not.toContain(tChanges("tag.removed"));
	});

	it("SCHEMA-F9 09 a select without options replaces the preview with what to fix, marks the field's row and blocks the save", async () => {
		state = stateOf({
			story: story({ subtitle: field("부제"), format: { kind: "select", label: "글 종류", options: {} } }),
		});
		openFields();
		await removeField("subtitle");
		// The title row's pill is off while the draft has a problem.
		expect(saveButton().disabled).toBe(true);
		fireEvent.click(saveButton());
		expect(api.sent("POST /v1/schema/preview")).toHaveLength(0);

		// The row says what is missing.
		expect(fieldRow("format").textContent).toContain(tProblem("mark.options"));

		const panel = await openPreview();
		expect(panel.textContent).toContain(tProblem("preview.fix"));
		expect(panel.textContent).toContain("글 종류");
		expect(panel.textContent).toContain(tProblem("problem.options"));
		// The form itself is not drawn.
		expect(within(panel).queryByText(tFields("layout.previewUnavailable"))).toBeNull();

		// Each item opens the sheet of its field.
		fireEvent.click(within(panel).getByRole("button", { name: /글 종류/ }));
		expect(await screen.findByRole("dialog")).toBeInTheDocument();
	});
});

/** The review sheet of the draft the test gives it, mounted by itself so the draft is exactly what the case needs. */
function Review(props: Partial<ComponentProps<typeof ReviewDialog>>) {
	const [isOpen, setOpen] = useState(true);
	return (
		<ReviewDialog
			open={isOpen}
			onOpenChange={setOpen}
			draft={{}}
			saved={{}}
			renames={[]}
			target={{ kind: "collection", name: "story", count: 1 }}
			baseHash="hash-1"
			onIssues={() => undefined}
			onSaved={() => undefined}
			onApplyFailed={() => undefined}
			{...props}
		/>
	);
}
const mount = (props: Partial<ComponentProps<typeof ReviewDialog>>) =>
	render(
		<AdminQueryProvider>
			<Review {...props} />
		</AdminQueryProvider>,
	);
const sheet = () => screen.findByRole("dialog");
const apply = (dialog: HTMLElement, name = tReview("review.save")) =>
	within(dialog).getByRole("button", { name }) as HTMLButtonElement;
const choose = async (dialog: HTMLElement, name: string | RegExp) => {
	fireEvent.click(within(dialog).getByRole("radio", { name }));
};
/** The buttons of the sheet that say what they do (the close × is named, not labelled), in their order. */
const actionNames = (dialog: HTMLElement) => names(within(dialog).getAllByRole("button")).filter(Boolean);
/** The sheet offers cancel and the plain apply, not the red one that deletes. */
const expectPlainApply = (dialog: HTMLElement) => {
	expect(within(dialog).getByRole("button", { name: tc("cancel") })).toBeInTheDocument();
	expect(apply(dialog)).toBeInTheDocument();
	expect(within(dialog).queryByRole("button", { name: tReview("drop.apply") })).toBeNull();
};

const LEDE = "field_removed:story:lede";
const SUBTITLE = "field_removed:story:subtitle";
const FORMAT = "field_added:story:format";
const rename: SuggestedTransform = { op: "renameField", collection: "story", from: "lede", to: "excerpt" };
const dropSubtitle: SuggestedTransform = { op: "dropField", collection: "story", field: "subtitle" };
const fill = (value: string): SuggestedTransform => ({ op: "setDefault", collection: "story", field: "format", value });

const fieldsDraft = {
	collections: {
		story: story({
			excerpt: field(LEDE_LABEL),
			subtitleTarget: field("소제목"),
			format: {
				kind: "select",
				label: "글 종류",
				required: true,
				options: { note: "메모", essay: "에세이", review: "리뷰" },
			},
		}),
	},
};
const fieldsSaved = { collections: { story: story({ lede: field(LEDE_LABEL), subtitle: field("부제") }) } };
const subtitleDecision: Decision = {
	key: SUBTITLE,
	change: { kind: "field_removed", collection: "story", field: "subtitle", fieldKind: "text" },
	entries: 132,
	sample,
	suggestions: [dropSubtitle],
	chosen: null,
};
const fieldChanges = preview({
	impacts: [
		{
			change: { kind: "field_renamed", collection: "story", from: "lede", to: "excerpt" },
			key: "field_renamed:story:lede:excerpt",
			entries: 148,
			sample,
			consequence: "transformed",
			checked: true,
		},
		{
			change: { kind: "field_removed", collection: "story", field: "subtitle", fieldKind: "text" },
			key: SUBTITLE,
			entries: 132,
			sample,
			consequence: "orphaned",
			checked: true,
		},
		{
			change: { kind: "field_added", collection: "story", field: "format", fieldKind: "select", required: true },
			key: FORMAT,
			entries: 148,
			sample,
			consequence: "publish_blocked",
			checked: true,
		},
	],
	decisions: [
		{
			key: LEDE,
			change: { kind: "field_removed", collection: "story", field: "lede", fieldKind: "text" },
			entries: 148,
			sample,
			suggestions: [rename, { op: "dropField", collection: "story", field: "lede" }],
			chosen: rename,
		},
		subtitleDecision,
		{
			key: FORMAT,
			change: { kind: "field_added", collection: "story", field: "format", fieldKind: "select", required: true },
			entries: 148,
			sample,
			suggestions: [fill("note"), fill("essay"), fill("review")],
			chosen: fill("note"),
		},
	],
	transforms: [],
});

describe("flow 4 · 필드 고치기 — 검토 (steps 11-12)", () => {
	const review = async () => {
		previewOf = () => fieldChanges;
		mount({
			draft: fieldsDraft,
			saved: fieldsSaved,
			renames: [{ kind: "field", collection: "story", from: "lede", to: "excerpt" }],
		});
		const dialog = await sheet();
		// The rename of lede to excerpt is its first choice, named for the field.
		await within(dialog).findByRole("radiogroup", { name: LEDE_LABEL });
		return dialog;
	};

	it("SCHEMA-F2 11 what is chosen is what the apply sends: the transforms, in the PUT", async () => {
		const dialog = await review();
		await choose(dialog, new RegExp(tReview("choice.move")));
		await choose(dialog, new RegExp(tReview("choice.erase")));
		await choose(
			dialog,
			new RegExp(
				tReview("choice.fill", { count: tReview("count.entries", { count: 148, kind: "document" }), kind: "document" }),
			),
		);
		await waitFor(() => expect(lastPreview()?.body.transforms).toEqual([rename, dropSubtitle, fill("note")]));

		fireEvent.click(apply(dialog, tReview("drop.apply")));
		await waitFor(() => expect(api.requests.map((request) => request.method)).toContain("PUT"));
		expect(put()?.body).toMatchObject({
			baseHash: "hash-1",
			transforms: [rename, dropSubtitle, fill("note")],
			renames: [{ kind: "field", collection: "story", from: "lede", to: "excerpt" }],
		});
		expect(put()?.body.acknowledged).toEqual(["field_renamed:story:lede:excerpt", SUBTITLE, FORMAT]);
	});

	it("SCHEMA-F2 12 choosing to delete the values turns the apply into 지우고 적용, and choosing keep turns it back", async () => {
		// The red of the deleting button is the promise itself (the warning before values are lost), and the visual stories do not run on
		// every push (#334), so its colour class is checked here too.
		const applyButton = (name: string) => within(dialog).getByRole("button", { name });
		const dialog = await review();
		expect(actionNames(dialog)).toEqual([tc("cancel"), tReview("review.save")]);
		expect(applyButton(tReview("review.save")).className).not.toContain("danger");

		await choose(dialog, new RegExp(tReview("choice.erase")));
		// The subtitle's block says what is lost, with its own count, and that it cannot be undone.
		expect(dialog.textContent).toContain(
			tReview("note.erased", { count: tReview("count.entries", { count: 132, kind: "document" }) }),
		);
		expect(actionNames(dialog)).toEqual([tc("cancel"), tReview("drop.apply")]);
		expect(applyButton(tReview("drop.apply")).className).toContain("bg-monti-danger-emphasis");

		await choose(dialog, new RegExp(tReview("choice.keep")));
		expect(actionNames(dialog)).toEqual([tc("cancel"), tReview("review.save")]);
	});

	it("SCHEMA-F3 11 moving the values of a removed field picks another field and sends the move", async () => {
		const dialog = await review();
		// Only the removed subtitle can keep its values, so the note of kept values is its own.
		expect(dialog.textContent).toContain(tReview("note.kept"));
		expect(within(dialog).getByRole("combobox", { name: tReview("choice.field") })).toBeInTheDocument();
		await choose(dialog, new RegExp(tReview("choice.moveTo")));
		const move = { op: "renameField", collection: "story", from: "subtitle", to: "excerpt" };
		await waitFor(() => expect(lastPreview()?.body.transforms).toContainEqual(move));
		// Moving the values says nothing about being lost.
		expect(dialog.textContent).not.toContain(tReview("note.kept"));
	});

	it("SCHEMA-F4 11 a change no entry holds a value for has nothing to choose", async () => {
		previewOf = () =>
			preview({
				...fieldChanges,
				decisions: [{ ...subtitleDecision, entries: 0 }],
				impacts: [],
			});
		mount({ draft: fieldsDraft, saved: fieldsSaved });
		// The removed subtitle is the sheet's one change.
		const dialog = await sheet();
		expect(await within(dialog).findByText(tReview("consequence.none"))).toBeInTheDocument();
		expect(within(dialog).queryAllByRole("radio")).toHaveLength(0);
		expect(apply(dialog).disabled).toBe(false);
	});

	it("SCHEMA-F17 when the file changed since the screen opened, the sheet says so, offers a reload and cannot apply", async () => {
		const dialog = await review();
		api.on("PUT /v1/schema", () => failure("schema_conflict", "conflict"));
		fireEvent.click(apply(dialog));
		const alert = await within(dialog).findByRole("alert");
		expect(alert.textContent).toContain(tReview("save.conflict.title"));
		expect(alert.textContent).toContain(tReview("save.conflict"));
		expect(apply(dialog).disabled).toBe(true);
		fireEvent.click(within(alert).getByRole("button", { name: tReview("save.reload") }));
		expect(reload.reloadPage).toHaveBeenCalled();
		expectPlainApply(dialog);
	});
});

describe("flow 4 · 주소 바꾸기 (steps 13-14)", () => {
	const KEY = "collection_path_changed:story";
	const pathDraft = { collections: { story: { ...story({}), path: "/blog/:slug" } } };
	const pathSaved = { collections: { story: story({}) } };

	it("SCHEMA-A1 14 shows the address before and after and the published entries that change, with no redirect to pick", async () => {
		previewOf = () =>
			preview({
				impacts: [
					{
						change: { kind: "collection_path_changed", collection: "story", from: "/stories/:slug", to: "/blog/:slug" },
						key: KEY,
						entries: 148,
						sample: [],
						consequence: "address_changed",
						checked: true,
					},
				],
			});
		mount({ draft: pathDraft, saved: pathSaved });
		// The address is the sheet's one change.
		const dialog = await sheet();
		expect(await within(dialog).findByText(tReview("tag.address"))).toBeInTheDocument();
		const block = dialog;
		expect(block.textContent).toContain(tReview("block.address"));
		expect(block.textContent).toContain("/stories/:slug");
		expect(block.textContent).toContain("/blog/:slug");
		// The count comes from the preview: 148 published entries change address.
		expect(block.textContent).toContain(tReview("path.entries"));
		expect(block.textContent).toContain(
			tReview("path.entries.then", { count: tReview("count.entries", { count: 148, kind: "document" }) }),
		);
		expect(block.textContent).toContain(tReview("path.note"));
		// Nothing to pick, nothing to tick: just cancel and apply.
		expect(within(block).queryAllByRole("radio")).toHaveLength(0);
		expect(within(block).queryAllByRole("checkbox")).toHaveLength(0);
		expectPlainApply(dialog);

		// It needs no acknowledgement of its own beyond the key the preview named, and the apply sends the PUT.
		fireEvent.click(apply(dialog));
		await waitFor(() => expect(api.requests.map((request) => request.method)).toContain("PUT"));
		expect(put()?.body).toMatchObject({ baseHash: "hash-1", acknowledged: [KEY] });
		expect(Object.keys(put()?.body ?? {})).not.toContain("redirects");
	});
});

describe("flow 4 · 새 컬렉션 (steps 05-06)", () => {
	const noteDraft = {
		collections: {
			story: story({}),
			note: {
				label: "노트",
				kind: "document",
				path: "/notes/:slug",
				fields: { title: field("제목", { required: true }), slug: { kind: "slug", label: "주소", from: "title" } },
			},
		},
	};
	const KEY = "collection_added:note";

	it("SCHEMA-N3 05 reviews the new collection as one block and says its stored data is not touched", async () => {
		previewOf = () =>
			preview({
				impacts: [
					{
						change: { kind: "collection_added", collection: "note" },
						key: KEY,
						entries: 0,
						sample: [],
						consequence: "none",
						checked: true,
					},
				],
			});
		mount({
			draft: noteDraft,
			saved: { collections: { story: story({}) } },
			target: { kind: "collection", name: "note", count: 1 },
		});
		// The new collection is the sheet's one change.
		const dialog = await sheet();
		expect(await within(dialog).findByText(tReview("tag.new"))).toBeInTheDocument();
		const block = dialog;
		expect(dialog.textContent).toContain(tReview("review.what", { name: "노트", count: 1 }));
		expect(block.textContent).toContain(`note · ${t("collection.kindDocument")}`);
		expect(block.textContent).toContain("/notes/:slug");
		expect(block.textContent).toContain("title, slug");
		expect(block.textContent).toContain(tReview("consequence.none"));
		expectPlainApply(dialog);
	});
});

describe("flow 4 · 새 컬렉션 — the page after the apply", () => {
	beforeEach(() => {
		state = stateOf({ story: story({ subtitle: field("부제") }) });
	});

	it("SCHEMA-N3 06 shows the line the save left, with 보기 opening the new collection's entries when it left a link", async () => {
		rememberSaved("노트를 만들었어요", "/admin?collection=note");
		openFields();
		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(
				"노트를 만들었어요",
				expect.objectContaining({ action: expect.objectContaining({ label: tReview("saved.view") }) }),
			),
		);
		expect(toast).toHaveBeenCalledTimes(1);
		const [, options] = toast.mock.calls.find(([message]) => message === "노트를 만들었어요") as [
			string,
			{ action: { onClick: () => void } },
		];
		options.action.onClick();
		expect(nav.navigate).toHaveBeenCalledWith("/admin?collection=note");
	});

	it("SCHEMA-F17 when the database does not take the saved file, the page says so with a way to reload", async () => {
		openFields();
		await removeField("subtitle");
		fireEvent.click(saveButton());
		const dialog = await sheet();
		await waitFor(() => expect(apply(dialog).disabled).toBe(false));
		api.on("PUT /v1/schema", () => failure("schema_apply_failed", "connect ECONNREFUSED"));
		fireEvent.click(apply(dialog));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain(tReview("applyFailed.title"));
		expect(alert.textContent).toContain(tReview("applyFailed.text", { message: "connect ECONNREFUSED" }));
		fireEvent.click(within(alert).getByRole("button", { name: tReview("save.reload") }));
		expect(reload.reloadPage).toHaveBeenCalled();
	});
});

describe("flow 11 · 언어 빼기 (step 08)", () => {
	const KEY = "locale_removed:en";
	const decision: Decision = {
		key: KEY,
		change: { kind: "locale_removed", locale: "en" },
		entries: 12,
		sample: [],
		suggestions: [{ op: "trashLocale", locale: "en" }],
		chosen: null,
	};
	beforeEach(() => {
		state = stateOf({ story: story({}) }, [
			{ code: "de", name: "Deutsch" },
			{ code: "en", name: "English", label: "영어" },
		]);
		previewOf = () =>
			preview({
				decisions: [decision],
				impacts: [
					{ change: decision.change, key: KEY, entries: 12, sample: [], consequence: "orphaned", checked: true },
				],
			});
	});

	const removeEnglish = async () => {
		window.history.replaceState(null, "", "/admin/settings/locales");
		open("locales");
		fireEvent.click(await screen.findByRole("button", { name: tLocales("locales.remove", { name: "English" }) }));
		fireEvent.click(saveButton());
		const dialog = await sheet();
		// The language taken out is the sheet's one change, its choice named for the language.
		await within(dialog).findByRole("radiogroup", { name: "English" });
		return dialog;
	};

	it("SCHEMA-C2 08 asks to keep the translations or move them to the trash, and keeping is the default", async () => {
		const dialog = await removeEnglish();
		expect(dialog.textContent).toContain(tReview("review.what", { name: tReview("area.locales"), count: 1 }));
		const block = dialog;
		expect(within(dialog).getByText(tReview("tag.locale"))).toBeInTheDocument();
		expect(block.textContent).toContain("English");
		expect(block.textContent).toContain(
			tReview("locale.key", { code: "en", count: tReview("count.entries", { count: 12, kind: "document" }) }),
		);
		const radio = (label: string) => within(dialog).getByRole("radio", { name: new RegExp(`^${label}`) });
		expect(radio(tReview("choice.keep")).getAttribute("aria-checked")).toBe("true");
		expect(radio(tReview("choice.trash")).getAttribute("aria-checked")).toBe("false");
		expect(block.textContent).toContain(tReview("note.locale"));
	});

	it("SCHEMA-C2 08 moving them to the trash sends trashLocales, in the check and in the save", async () => {
		const dialog = await removeEnglish();
		await choose(dialog, new RegExp(tReview("choice.trash")));
		await waitFor(() => expect(lastPreview()?.body.trashLocales).toEqual(["en"]));

		fireEvent.click(apply(dialog));
		await waitFor(() => expect(api.requests.map((request) => request.method)).toContain("PUT"));
		expect(put()?.body.trashLocales).toEqual(["en"]);
		expect(put()?.body.transforms).toEqual([]);
		expect(toast).not.toHaveBeenCalled();
	});
});
