import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { commonMessages } from "../../../lib/common.messages";
import { jsonResponse as json } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { toast } from "../../../test/ui-toast";
import { AdminQueryProvider } from "../../shared/query-provider";
import { schemaChangesMessages } from "../changes.messages";
import { schemaFieldsMessages } from "../fields.messages";
import { schemaLocalesMessages } from "../locales.messages";
import { schemaMessages } from "../messages";
import { schemaProblemMessages } from "../problems.messages";
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
const reload = vi.hoisted(() => ({ reloadPage: vi.fn(), rememberSaved: vi.fn(), takeSavedMessage: vi.fn(() => null) }));
vi.mock("../reload", () => reload);

const field = (label: string, extra: object = {}) => ({ kind: "text", label, ...extra });
const post = (fields: Record<string, unknown>) => ({
	label: "게시글",
	kind: "document",
	path: "/posts/:slug",
	fields: {
		title: field("제목", { required: true }),
		slug: { kind: "slug", label: "주소", from: "title" },
		...fields,
	},
});

const stateOf = (collections: Record<string, unknown>, locales: unknown[] = [{ code: "ko", name: "한국어" }]) => ({
	access: { writable: true },
	file: "monti.schema.ts",
	hash: "hash-1",
	schema: { collections, locales, defaultLocale: "ko" },
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

const sample = [
	{ id: "e-1", title: "첫 번째 글", collection: "post", locale: "ko", status: "published" },
	{ id: "e-2", title: "발행 후 고친 글", collection: "post", locale: "ko", status: "published" },
];
const preview = (over: Record<string, unknown> = {}) => ({
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

type Sent = { method: string; url: string; body?: Record<string, unknown> };
let requests: Sent[];
let state: ReturnType<typeof stateOf>;
let previewOf: () => unknown;
let saved: Record<string, unknown>;

beforeEach(() => {
	vi.clearAllMocks();
	requests = [];
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
	};
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string, init?: RequestInit) => {
			const method = init?.method ?? "GET";
			const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
			requests.push({ method, url: input, body });
			if (input === "/api/monti/v1/schema" && method === "GET") return json(state);
			if (input === "/api/monti/v1/schema/preview") return json(previewOf());
			if (input === "/api/monti/v1/schema" && method === "PUT") return json(saved);
			throw new Error(`Unexpected fetch ${method} ${input}`);
		}),
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const lastPreview = () => requests.filter((request) => request.url.endsWith("/preview")).at(-1);
const put = () => requests.find((request) => request.method === "PUT");
const names = (buttons: HTMLElement[]) => buttons.map((button) => button.textContent);

const open = (tab: "collections" | "locales" = "collections") =>
	render(
		<AdminQueryProvider>
			<SchemaSettings tab={tab} />
		</AdminQueryProvider>,
	);
const openFields = () => {
	window.history.replaceState(null, "", "/admin/settings/collections?collection=post&section=fields");
	return open();
};
/** Removes a field of the open collection from its row. */
const removeField = async (name: string) =>
	fireEvent.click(await screen.findByRole("button", { name: t("row.remove", { name }) }));
/** Opens the preview panel of the open collection if it is not open (it starts open on a wide window). */
const openPreview = async () => {
	const toggle = await screen.findByRole("button", { name: tFields("layout.previewTitle") });
	if (toggle.getAttribute("aria-pressed") !== "true") fireEvent.click(toggle);
	return screen.findByTestId("layout-preview");
};
const bar = () => screen.getByTestId("save-bar");
const saveButton = () => within(bar()).getByRole("button", { name: t("bar.save") }) as HTMLButtonElement;

describe("flow 4 · 필드 고치기 — 바뀐 곳, 미리보기, 고칠 곳 (steps 07-10)", () => {
	beforeEach(() => {
		state = stateOf({
			post: post({
				summary: field("요약"),
				subtitle: field("부제"),
				extra: field("덧말"),
				format: { kind: "select", label: "글 종류", options: { note: "메모", essay: "에세이" } },
			}),
		});
	});

	it("07 counts every changed field, 10 lists them with one undo each and takes one back", async () => {
		openFields();
		await removeField("subtitle");
		await removeField("summary");
		await removeField("extra");
		expect(within(bar()).getByLabelText(t("bar.count", { count: 3 }))).toBeInTheDocument();

		fireEvent.click(within(bar()).getByRole("button", { name: t("bar.list") }));
		const rows = await screen.findAllByRole("menuitem");
		expect(rows).toHaveLength(3);
		for (const row of rows) expect(row.textContent).toContain(t("bar.undo"));
		expect(rows.map((row) => row.textContent).join(" ")).toContain(tChanges("tag.removed"));

		fireEvent.click(rows[0] as HTMLElement);
		await waitFor(() => expect(within(bar()).getByLabelText(t("bar.count", { count: 2 }))).toBeInTheDocument());
	});

	it("07 marks a rename with its old name, a removed field struck in its place and a new field, and takes each back from the list", async () => {
		openFields();
		// A rename: the name is taken from the field's sheet on Save.
		fireEvent.click(await screen.findByRole("button", { name: tFields("field.toggle", { name: "summary" }) }));
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
		const renamed = screen.getByTestId("field-excerpt");
		expect(renamed.textContent).toContain("\u2190 summary");
		const gone = screen.getByTestId("gone-subtitle");
		expect(gone.textContent).toContain(tChanges("tag.removed"));
		expect(within(gone).queryByRole("button")).toBeNull();
		expect(gone.querySelector(".line-through")).toBeInTheDocument();
		expect(screen.getByTestId("field-lead").textContent).toContain(tChanges("tag.added"));
		// The struck row stays where the field was: after the renamed one, before the one that follows it.
		const order = within(screen.getByRole("list", { name: tFields("field.title") }))
			.getAllByRole("listitem")
			.map((row) => row.getAttribute("data-testid"));
		expect(order.indexOf("gone-subtitle")).toBe(order.indexOf("field-excerpt") + 1);

		// Each one is taken back from the list of changes: the row goes back to what it was.
		fireEvent.click(within(bar()).getByRole("button", { name: t("bar.list") }));
		const rows = await screen.findAllByRole("menuitem");
		const removal = rows.find((row) => row.textContent?.includes(tChanges("tag.removed")));
		fireEvent.click(removal as HTMLElement);
		await waitFor(() => expect(screen.queryByTestId("gone-subtitle")).toBeNull());
		expect(screen.getByTestId("field-subtitle").textContent).not.toContain(tChanges("tag.removed"));
	});

	it("09 a select without options replaces the preview with what to fix, marks the field's row and blocks the save", async () => {
		state = stateOf({
			post: post({ subtitle: field("부제"), format: { kind: "select", label: "글 종류", options: {} } }),
		});
		openFields();
		await removeField("subtitle");
		// The title row's pill is off while the draft has a problem.
		expect(saveButton().disabled).toBe(true);
		fireEvent.click(saveButton());
		expect(requests.some((request) => request.url.endsWith("/preview"))).toBe(false);

		// The row says what is missing, in the danger color.
		const row = screen.getByTestId("field-format");
		expect(row.textContent).toContain(tProblem("mark.options"));
		expect(
			within(row)
				.getByText(/^format/)
				.closest("span")?.className,
		).toContain("text-monti-danger");

		const panel = await openPreview();
		const problems = within(panel).getByTestId("layout-preview-problems");
		expect(problems.textContent).toContain(tProblem("preview.fix"));
		expect(problems.textContent).toContain("글 종류");
		expect(problems.textContent).toContain(tProblem("problem.options"));
		// The form itself is not drawn.
		expect(within(panel).queryByText(tFields("layout.previewUnavailable"))).toBeNull();

		// Each item opens the sheet of its field.
		fireEvent.click(within(problems).getByRole("button", { name: /글 종류/ }));
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
			target={{ kind: "collection", name: "post", count: 1 }}
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
const footerNames = (dialog: HTMLElement) =>
	names(within(dialog.querySelector('[data-slot="sheet-footer"]') as HTMLElement).getAllByRole("button"));

const SUMMARY = "field_removed:post:summary";
const SUBTITLE = "field_removed:post:subtitle";
const FORMAT = "field_added:post:format";
const change = (kind: string, rest: object) => ({ kind, collection: "post", ...rest });
const rename = { op: "renameField", collection: "post", from: "summary", to: "excerpt" };
const dropSubtitle = { op: "dropField", collection: "post", field: "subtitle" };
const fill = (value: string) => ({ op: "setDefault", collection: "post", field: "format", value });

const fieldsDraft = {
	collections: {
		post: post({
			excerpt: field("요약"),
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
const fieldsSaved = { collections: { post: post({ summary: field("요약"), subtitle: field("부제") }) } };
const fieldChanges = preview({
	impacts: [
		{
			change: change("field_renamed", { from: "summary", to: "excerpt" }),
			key: "field_renamed:post:summary:excerpt",
			entries: 148,
			sample,
			consequence: "transformed",
			checked: true,
		},
		{
			change: change("field_removed", { field: "subtitle", fieldKind: "text" }),
			key: SUBTITLE,
			entries: 132,
			sample,
			consequence: "orphaned",
			checked: true,
		},
		{
			change: change("field_added", { field: "format", fieldKind: "select", required: true }),
			key: FORMAT,
			entries: 148,
			sample,
			consequence: "publish_blocked",
			checked: true,
		},
	],
	decisions: [
		{
			key: SUMMARY,
			change: change("field_removed", { field: "summary", fieldKind: "text" }),
			entries: 148,
			sample,
			suggestions: [rename, { op: "dropField", collection: "post", field: "summary" }],
			chosen: rename,
		},
		{
			key: SUBTITLE,
			change: change("field_removed", { field: "subtitle", fieldKind: "text" }),
			entries: 132,
			sample,
			suggestions: [dropSubtitle],
			chosen: null,
		},
		{
			key: FORMAT,
			change: change("field_added", { field: "format", fieldKind: "select", required: true }),
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
			renames: [{ kind: "field", collection: "post", from: "summary", to: "excerpt" }],
		});
		const dialog = await sheet();
		await within(dialog).findByTestId(`impact-${SUMMARY}`);
		return dialog;
	};

	it("11 what is chosen is what the apply sends: the transforms, in the PUT", async () => {
		const dialog = await review();
		// The first request had no picks: the server's own defaults.
		expect(lastPreview()?.body?.transforms).toBeUndefined();

		// Start the renamed field empty, and fill the required one with nothing: both leave their transforms out of the request.
		await choose(dialog, new RegExp(tReview("choice.blank")));
		await choose(dialog, new RegExp(tReview("choice.leave")));
		await waitFor(() => expect(lastPreview()?.body?.transforms).toEqual([]));
		await choose(dialog, new RegExp(tReview("choice.move")));
		await choose(dialog, new RegExp(tReview("choice.erase")));
		await waitFor(() => expect(lastPreview()?.body?.transforms).toEqual([rename, dropSubtitle]));
		await choose(dialog, new RegExp(tReview("choice.fill", { count: "148편", kind: "document" })));
		await waitFor(() => expect(lastPreview()?.body?.transforms).toEqual([rename, dropSubtitle, fill("note")]));

		fireEvent.click(apply(dialog, tReview("drop.apply")));
		await waitFor(() => expect(requests.map((request) => request.method)).toContain("PUT"));
		expect(put()?.body).toMatchObject({
			baseHash: "hash-1",
			transforms: [rename, dropSubtitle, fill("note")],
			renames: [{ kind: "field", collection: "post", from: "summary", to: "excerpt" }],
		});
		expect(put()?.body?.acknowledged).toEqual(["field_renamed:post:summary:excerpt", SUBTITLE, FORMAT]);
	});

	it("12 choosing to delete the values turns the apply into the red 지우고 적용, and choosing keep turns it back", async () => {
		const dialog = await review();
		const button = apply(dialog);
		expect(button.className).toContain("bg-monti-emphasis");
		expect(button.className).not.toContain("danger");

		await choose(dialog, new RegExp(tReview("choice.erase")));
		const danger = apply(dialog, tReview("drop.apply"));
		expect(danger.className).toContain("bg-monti-danger-emphasis");
		// The block says what is lost, and that it cannot be undone.
		expect(within(dialog).getByTestId(`impact-${SUBTITLE}`).textContent).toContain(
			tReview("note.erased", { count: tReview("count.entries", { count: 132, kind: "document" }) }),
		);
		expect(footerNames(dialog)).toEqual([tc("cancel"), tReview("drop.apply")]);

		await choose(dialog, new RegExp(tReview("choice.keep")));
		expect(apply(dialog).className).toContain("bg-monti-emphasis");
	});

	it("11 moving the values of a removed field offers the other fields of its kind, never the title", async () => {
		const dialog = await review();
		const removed = within(dialog).getByTestId(`impact-${SUBTITLE}`);
		expect(within(removed).getByRole("combobox", { name: tReview("choice.field") })).toBeInTheDocument();
		await choose(dialog, new RegExp(tReview("choice.moveTo")));
		const move = { op: "renameField", collection: "post", from: "subtitle", to: "excerpt" };
		await waitFor(() => expect(lastPreview()?.body?.transforms).toContainEqual(move));
		// Moving the values deletes nothing and says nothing about being lost.
		expect(apply(dialog).className).not.toContain("danger");
		expect(removed.textContent).not.toContain(tReview("note.kept"));
	});

	it("11 a change no entry holds a value for has nothing to choose", async () => {
		previewOf = () =>
			preview({
				...fieldChanges,
				decisions: [{ ...(fieldChanges.decisions as object[])[1], entries: 0 }],
				impacts: [],
			});
		mount({ draft: fieldsDraft, saved: fieldsSaved });
		const dialog = await sheet();
		const block = await within(dialog).findByTestId(`impact-${SUBTITLE}`);
		expect(within(block).queryAllByRole("radio")).toHaveLength(0);
		expect(block.textContent).toContain(tReview("consequence.none"));
		expect(apply(dialog).disabled).toBe(false);
	});

	it("when the file changed since the screen opened, the sheet says so, offers a reload and cannot apply", async () => {
		const dialog = await review();
		const fetcher = vi.mocked(fetch);
		const answer = fetcher.getMockImplementation();
		fetcher.mockImplementation(async (input, init) =>
			init?.method === "PUT"
				? (json({ error: { code: "schema_conflict", message: "conflict" } }, 409) as never)
				: ((await answer?.(input, init)) as never),
		);
		fireEvent.click(apply(dialog));
		const alert = await within(dialog).findByRole("alert");
		expect(alert.textContent).toContain(tReview("save.conflict.title"));
		expect(alert.textContent).toContain(tReview("save.conflict"));
		expect(apply(dialog).disabled).toBe(true);
		fireEvent.click(within(alert).getByRole("button", { name: tReview("save.reload") }));
		expect(reload.reloadPage).toHaveBeenCalled();
		expect(footerNames(dialog)).toEqual([tc("cancel"), tReview("review.save")]);
	});

	it("when the file is saved but the database does not take it, the sheet closes and the screen is told what the server said", async () => {
		const onApplyFailed = vi.fn();
		previewOf = () => fieldChanges;
		mount({ draft: fieldsDraft, saved: fieldsSaved, onApplyFailed });
		const dialog = await sheet();
		await within(dialog).findByTestId(`impact-${SUMMARY}`);
		const fetcher = vi.mocked(fetch);
		const answer = fetcher.getMockImplementation();
		fetcher.mockImplementation(async (input, init) =>
			init?.method === "PUT"
				? (json({ error: { code: "schema_apply_failed", message: "connect ECONNREFUSED" } }, 500) as never)
				: ((await answer?.(input, init)) as never),
		);
		fireEvent.click(apply(dialog));
		await waitFor(() => expect(onApplyFailed).toHaveBeenCalledWith("connect ECONNREFUSED"));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});
});

describe("flow 4 · 주소 바꾸기 (steps 13-14)", () => {
	const KEY = "collection_path_changed:post";
	const pathDraft = { collections: { post: { ...post({}), path: "/blog/:slug" } } };
	const pathSaved = { collections: { post: post({}) } };

	it("14 shows the address before and after and the published entries that change, with no redirect to pick", async () => {
		previewOf = () =>
			preview({
				impacts: [
					{
						change: change("collection_path_changed", { from: "/posts/:slug", to: "/blog/:slug" }),
						key: KEY,
						entries: 148,
						sample: [],
						consequence: "address_changed",
						checked: true,
					},
				],
			});
		mount({ draft: pathDraft, saved: pathSaved });
		const dialog = await sheet();
		const block = await within(dialog).findByTestId(`impact-${KEY}`);
		expect(block.querySelector('[data-slot="change-tag"]')?.textContent).toBe(tReview("tag.address"));
		expect(block.textContent).toContain(tReview("block.address"));
		expect(block.textContent).toContain("/posts/:slug");
		expect(block.textContent).toContain("/blog/:slug");
		// The count comes from the preview: 148 published entries change address.
		expect(block.textContent).toContain(tReview("path.entries"));
		expect(block.textContent).toContain(tReview("path.entries.then", { count: "148편" }));
		expect(block.textContent).toContain(tReview("path.note"));
		// Nothing to pick, nothing to tick: just cancel and apply.
		expect(within(block).queryAllByRole("radio")).toHaveLength(0);
		expect(within(block).queryAllByRole("checkbox")).toHaveLength(0);
		expect(footerNames(dialog)).toEqual([tc("cancel"), tReview("review.save")]);

		// It needs no acknowledgement of its own beyond the key the preview named, and the apply sends the PUT.
		fireEvent.click(apply(dialog));
		await waitFor(() => expect(requests.map((request) => request.method)).toContain("PUT"));
		expect(put()?.body).toMatchObject({ baseHash: "hash-1", acknowledged: [KEY] });
		expect(Object.keys(put()?.body ?? {})).not.toContain("redirects");
	});
});

describe("flow 4 · 새 컬렉션 (steps 05-06)", () => {
	const noteDraft = {
		collections: {
			post: post({}),
			note: {
				label: "노트",
				kind: "document",
				path: "/notes/:slug",
				fields: { title: field("제목", { required: true }), slug: { kind: "slug", label: "주소", from: "title" } },
			},
		},
	};
	const KEY = "collection_added:note";

	it("05 reviews the new collection as one block and says its stored data is not touched", async () => {
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
			saved: { collections: { post: post({}) } },
			target: { kind: "collection", name: "note", count: 1 },
		});
		const dialog = await sheet();
		const block = await within(dialog).findByTestId(`impact-${KEY}`);
		expect(dialog.textContent).toContain(tReview("review.what", { name: "노트", count: 1 }));
		expect(block.querySelector('[data-slot="change-tag"]')?.textContent).toBe(tReview("tag.new"));
		expect(block.textContent).toContain("note · 문서");
		expect(block.textContent).toContain("/notes/:slug");
		expect(block.textContent).toContain("title, slug");
		expect(block.textContent).toContain(tReview("consequence.none"));
		expect(footerNames(dialog)).toEqual([tc("cancel"), tReview("review.save")]);
	});
});

describe("flow 4 · 새 컬렉션 — the page after the apply", () => {
	beforeEach(() => {
		state = stateOf({ post: post({ subtitle: field("부제") }) });
	});

	it("06 shows the line the save left, with 보기 opening the new collection's entries when it left a link", async () => {
		reload.takeSavedMessage.mockReturnValueOnce({
			message: "노트를 만들었어요",
			href: "/admin?collection=note",
		} as never);
		openFields();
		await screen.findByTestId("schema-screen");
		expect(toast).toHaveBeenCalledTimes(1);
		const [message, options] = toast.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
		expect(message).toBe("노트를 만들었어요");
		expect(options.action.label).toBe(tReview("saved.view"));
		options.action.onClick();
		expect(nav.navigate).toHaveBeenCalledWith("/admin?collection=note");
	});

	it("when the database does not take the saved file, the page says so with a way to reload", async () => {
		openFields();
		await removeField("subtitle");
		fireEvent.click(saveButton());
		const dialog = await sheet();
		await waitFor(() => expect(apply(dialog).disabled).toBe(false));
		const fetcher = vi.mocked(fetch);
		const answer = fetcher.getMockImplementation();
		fetcher.mockImplementation(async (input, init) =>
			init?.method === "PUT"
				? (json({ error: { code: "schema_apply_failed", message: "connect ECONNREFUSED" } }, 500) as never)
				: ((await answer?.(input, init)) as never),
		);
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
	const decision = {
		key: KEY,
		change: { kind: "locale_removed", locale: "en" },
		entries: 12,
		sample: [],
		suggestions: [{ op: "trashLocale", locale: "en" }],
		chosen: null,
	};
	beforeEach(() => {
		state = stateOf({ post: post({}) }, [
			{ code: "ko", name: "한국어" },
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
		await within(dialog).findByTestId(`impact-${KEY}`);
		return dialog;
	};

	it("08 asks to keep the translations or move them to the trash, and keeping is the default", async () => {
		const dialog = await removeEnglish();
		expect(dialog.textContent).toContain(tReview("review.what", { name: tReview("area.locales"), count: 1 }));
		const block = within(dialog).getByTestId(`impact-${KEY}`);
		expect(block.querySelector('[data-slot="change-tag"]')?.textContent).toBe(tReview("tag.locale"));
		expect(block.textContent).toContain("English");
		expect(block.textContent).toContain("en · 번역 12편");
		expect(
			within(block)
				.getAllByRole("radio")
				.map((radio) => radio.getAttribute("aria-checked")),
		).toEqual(["true", "false"]);
		expect(block.textContent).toContain(tReview("note.locale"));
		expect(lastPreview()?.body?.trashLocales).toBeUndefined();
		// Keeping them is not deleting anything: the apply is not red.
		expect(apply(dialog).className).not.toContain("danger");
	});

	it("08 moving them to the trash sends trashLocales, in the check and in the save", async () => {
		const dialog = await removeEnglish();
		await choose(dialog, new RegExp(tReview("choice.trash")));
		await waitFor(() => expect(lastPreview()?.body?.trashLocales).toEqual(["en"]));
		// A pick for a language is not a transform of the data.
		expect(lastPreview()?.body?.transforms).toEqual([]);
		expect(apply(dialog).className).not.toContain("danger");

		fireEvent.click(apply(dialog));
		await waitFor(() => expect(requests.map((request) => request.method)).toContain("PUT"));
		expect(put()?.body?.trashLocales).toEqual(["en"]);
		expect(put()?.body?.transforms).toEqual([]);
		expect(toast).not.toHaveBeenCalled();
	});
});
