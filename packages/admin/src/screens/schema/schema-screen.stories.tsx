import { toast } from "@monti-cms/ui";
import type { Meta } from "@storybook/react-vite";
import {
	answer,
	body,
	type Canvas,
	changesButton,
	expect,
	type FakeApi,
	fireEvent,
	openReview,
	type Play,
	previewOf,
	readOnlyState,
	SCHEMA,
	schema,
	screenState,
	server,
	setValue,
	story,
	t,
	tCollection,
	tFields,
	tReview,
	userEvent,
	waitFor,
	within,
} from "../../test/schema-story-api";
import { rememberSaved } from "./reload";

/**
 * The collections of Settings, one story per stage of the Schema board of the canvas (flow 4) except the production, PR and read-only-production stages
 * (not in this epic). Every story is shot by the visual checks.
 */
const meta = {
	title: "Screens/Schema",
	parameters: { layout: "fullscreen", bleed: true },
	tags: ["visual"],
} satisfies Meta;
export default meta;

const FIELDS = { collection: "post", section: "fields" };
const BASICS = { collection: "post", section: "basics" };

const find = (canvas: Canvas) => within(canvas);
const click = async (element: HTMLElement) => userEvent.click(element);

/** The preview of the properties panel is remembered per browser and open on a wide window: a story says which it shows. */
const preview =
	(open: boolean): Play =>
	async ({ canvasElement }) => {
		const toggle = await find(canvasElement).findByRole("button", { name: tFields("layout.previewTitle") });
		if ((toggle.getAttribute("aria-pressed") === "true") !== open) await click(toggle);
	};

/** Runs the steps in order. */
const steps =
	(...plays: Play[]): Play =>
	async (context) => {
		for (const play of plays) await play(context);
	};

// ----- the collection, its tabs -----

/** Stage 보통: the fields tab, the tree of the post collection with the panel preview closed. */
export const Fields = story(server(), "collections", FIELDS, { play: preview(false) });

/** Board CollectionBasics (stage 보통, tab 기본): the view and the structure, and the block that deletes the collection. */
export const Basics = story(server(), "collections", BASICS);

// ----- a new collection (steps 01-06) -----

/** Opens the sheet of a new collection and types the name 노트 and the identifier. */
const newCollection =
	(id: string): Play =>
	async ({ canvasElement }) => {
		await click(await find(canvasElement).findByRole("button", { name: t("collection.create") }));
		const sheet = await body().findByRole("dialog", { name: tCollection("collection.createTitle") });
		setValue(within(sheet).getByRole("textbox", { name: tCollection("collection.newName") }), "노트");
		setValue(within(sheet).getByRole("textbox", { name: new RegExp(`^${tCollection("collection.newId")}`) }), id);
	};

/** Stage 새 컬렉션: the sheet on the right with the name and the identifier typed. */
export const NewCollection = story(server(), "collections", FIELDS, { play: newCollection("note") });

/** Stage 새 컬렉션 오류: an identifier that is taken shows the one error line and keeps 만들기 off. */
export const NewCollectionError = story(server(), "collections", FIELDS, { play: newCollection("memo") });

const create: Play = async ({ canvasElement }) => {
	await newCollection("note")({ canvasElement } as never);
	const sheet = await body().findByRole("dialog");
	await click(within(sheet).getByRole("button", { name: tCollection("collection.createConfirm") }));
	await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());
	// Focus went back to the button that opened the sheet; the board shows no ring on it.
	(document.activeElement as HTMLElement | null)?.blur();
};

/** Stage 만든 직후: the new collection opens on its fields (title and slug) and the title row counts one change. */
export const NewCollectionCreated = story(server(), "collections", FIELDS, { play: create });

/** Opens the add-field sheet of the open collection and returns it. */
const openAddField = async (canvasElement: HTMLElement, collection: string) => {
	const editor = await find(canvasElement).findByTestId(`collection-${collection}`);
	await click(within(editor).getByRole("button", { name: `+ ${tFields("field.add")}` }));
	return body().findByRole("dialog", { name: new RegExp(tFields("field.addTitle")) });
};
const kindOf = (sheet: HTMLElement, kind: "text" | "select" | "media" | "relation") =>
	click(within(sheet).getByRole("option", { name: tFields(`kind.${kind}`) }));
const typeLabelAndName = (sheet: HTMLElement, label: string, name: string) => {
	setValue(within(sheet).getByRole("textbox", { name: tFields("field.label") }), label);
	setValue(within(sheet).getByRole("textbox", { name: tFields("field.name") }), name);
};

/** Focus stays on what was clicked last; the boards show no ring on it. */
const unfocus = () => (document.activeElement as HTMLElement | null)?.blur();
const describe = (sheet: HTMLElement, text: string) =>
	setValue(within(sheet).getByRole("textbox", { name: tFields("field.description") }), text);

/** Stage 노트 필드 추가, kind 글자: a text field of the new collection, several lines, 120 characters, per language. */
export const NoteFieldText = story(server(), "collections", FIELDS, {
	play: steps(create, async ({ canvasElement }) => {
		const sheet = await openAddField(canvasElement, "note");
		typeLabelAndName(sheet, "요약", "summary");
		describe(sheet, "결론을 먼저, 120자 안으로.");
		await click(within(sheet).getByRole("switch", { name: tFields("field.multiline") }));
		setValue(within(sheet).getByRole("spinbutton", { name: tFields("field.max") }), "120");
		setValue(within(sheet).getByRole("spinbutton", { name: tFields("field.rows") }), "3");
		setValue(within(sheet).getByRole("textbox", { name: tFields("field.placeholder") }), "목록과 검색에 보일 한 문장");
		await click(within(sheet).getByRole("switch", { name: tFields("field.fillFromBody") }));
		await click(within(sheet).getByRole("button", { name: tFields("field.localizedOwn") }));
		unfocus();
	}),
});

/** Stage 노트 필드 추가, kind 고르기: a choice with its three options. */
export const NoteFieldSelect = story(server(), "collections", FIELDS, {
	play: steps(create, async ({ canvasElement }) => {
		const sheet = await openAddField(canvasElement, "note");
		await kindOf(sheet, "select");
		typeLabelAndName(sheet, "글 종류", "format");
		describe(sheet, "목록에서 글을 묶어 보여 줄 때 쓴다.");
		const options = [
			["note", "메모"],
			["essay", "에세이"],
			["review", "리뷰"],
		] as const;
		for (const [at, [value, label]] of options.entries()) {
			if (at > 0) await click(within(sheet).getByRole("button", { name: tFields("options.add") }));
			const valueInput = within(sheet).getAllByRole("textbox", { name: tFields("options.value") })[at] as HTMLElement;
			setValue(valueInput, value);
			// The value is committed when the input is left.
			fireEvent.focusOut(valueInput);
			setValue(
				within(sheet).getAllByRole("textbox", { name: new RegExp(`^${tFields("options.label").slice(0, 2)}`) })[
					at
				] as HTMLElement,
				label,
			);
		}
		unfocus();
	}),
});

/** Stage 노트 필드 추가, kind 관계: a relation to the 시리즈 collection. */
export const NoteFieldRelation = story(server(), "collections", FIELDS, {
	play: steps(create, async ({ canvasElement }) => {
		const sheet = await openAddField(canvasElement, "note");
		await kindOf(sheet, "relation");
		typeLabelAndName(sheet, "시리즈", "series");
		describe(sheet, "이 글이 속한 연재. 같은 연재 글끼리 앞뒤로 이어 준다.");
		await click(within(sheet).getByRole("combobox", { name: tFields("field.relationTo") }));
		await click(await body().findByRole("option", { name: "시리즈" }));
		// The select gives focus back to its trigger after its list closes.
		await new Promise((resolve) => setTimeout(resolve, 300));
		unfocus();
	}),
});

/** Stage 새 컬렉션 검토: the review of a new collection. */
const newReview = previewOf({
	impacts: [
		{
			change: { kind: "collection_added", collection: "note" },
			key: "collection_added:note",
			entries: 0,
			sample: [],
			consequence: "none",
			checked: true,
		},
	],
});
export const NewCollectionReview = story(server({ preview: newReview }), "collections", FIELDS, {
	play: steps(create, async ({ canvasElement }) => {
		await openReview(canvasElement);
	}),
});

/** The server after the collection is saved: 노트 is in the file. */
const withNote = () => {
	const base = schema();
	return {
		...base,
		collections: {
			...base.collections,
			note: {
				label: "노트",
				kind: "document",
				path: "/notes/:slug",
				fields: {
					title: { kind: "text", label: "제목", required: true },
					slug: { kind: "slug", label: "주소", from: "title" },
				},
			},
		},
	};
};

/** Stage 만듦: the page after the save: 노트 in the list, and the toast that says so with 보기. */
export const NewCollectionSaved = story(
	server({
		state: screenState({
			schema: withNote(),
			collections: ["post", "memo", "category", "tag", "series", "note"],
		}),
	}),
	"collections",
	{ collection: "note", section: "fields" },
	{
		before: () =>
			rememberSaved(tReview("saved.created", { name: "노트" }), "/admin/settings/collections?collection=note"),
	},
);

// ----- fields (steps 07-12) -----

const removeField = async (canvasElement: HTMLElement, name: string) =>
	click(await find(canvasElement).findByRole("button", { name: t("row.remove", { name }) }));

/**
 * Three changes of the post collection, like the board's: 요약 renamed to excerpt (from its sheet), 부제 deleted, and a new field 글 종류 (a choice,
 * required).
 */
const changeFields: Play = async ({ canvasElement }) => {
	const editor = await find(canvasElement).findByTestId("collection-post");
	await click(within(editor).getByRole("button", { name: tFields("field.toggle", { name: "summary" }) }));
	const sheet = await body().findByRole("dialog");
	const nameBox = within(sheet).getByRole("textbox", { name: tFields("field.name") });
	setValue(nameBox, "excerpt");
	fireEvent.focusOut(nameBox);
	await click(within(sheet).getByRole("button", { name: tFields("sheet.save") }));
	await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());
	await removeField(canvasElement, "subtitle");
	const adding = await openAddField(canvasElement, "post");
	await kindOf(adding, "select");
	typeLabelAndName(adding, "글 종류", "format");
	await click(within(adding).getByRole("switch", { name: tFields("field.required") }));
	await click(within(adding).getByRole("button", { name: tFields("options.add") }));
	const [first] = within(adding).getAllByRole("textbox", { name: new RegExp(`^${tFields("options.value")}`) });
	if (first) {
		setValue(first, "note");
		fireEvent.focusOut(first);
	}
	await click(within(adding).getByRole("button", { name: tFields("field.add") }));
	await waitFor(() => expect(body().queryByRole("dialog")).toBeNull());
	unfocus();
};

/** Stage 필드 바꿈: the fields tab with three changes counted in the title row. */
export const FieldsChanged = story(server(), "collections", FIELDS, {
	play: steps(preview(false), changeFields),
});

/** Stage 미리보기: the panel preview beside the tree, labelled as the draft that is not saved. */
export const FieldsPreview = story(server(), "collections", FIELDS, {
	play: steps(changeFields, preview(true)),
});

const brokenSelect = () => {
	const base = schema();
	return {
		...base,
		collections: {
			...base.collections,
			post: {
				...base.collections.post,
				fields: {
					...base.collections.post.fields,
					format: { kind: "select", label: "글 종류", required: true, options: {} },
				},
			},
		},
	};
};

/** Stage 미리보기 오류: a choice without options replaces the preview with what to fix, and the save is off. */
export const FieldsPreviewError = story(
	server({ state: screenState({ schema: brokenSelect() }) }),
	"collections",
	FIELDS,
	{
		play: steps(async ({ canvasElement }) => {
			await removeField(canvasElement, "subtitle");
		}, preview(true)),
	},
);

/** Stage 바꾼 곳 목록: the menu of the changes with one undo each. */
export const FieldsChangesMenu = story(server(), "collections", FIELDS, {
	play: steps(preview(false), changeFields, async ({ canvasElement }) => {
		await click(await changesButton(canvasElement));
		await body().findByRole("menu");
	}),
});

const SAMPLE = [
	{ id: "e-1", title: "첫 번째 글", collection: "post", locale: "ko", status: "published" },
	{ id: "e-2", title: "발행 후 고친 글", collection: "post", locale: "ko", status: "published" },
];
const dropSubtitle = { op: "dropField", collection: "post", field: "subtitle" };
const fill = (value: string) => ({ op: "setDefault", collection: "post", field: "format", value });
const change = (kind: string, rest: object) => ({ kind, collection: "post", ...rest });
const RENAME = "field_removed:post:summary";
const renameField = { op: "renameField", collection: "post", from: "summary", to: "excerpt" };
const SUBTITLE = "field_removed:post:subtitle";
const FORMAT = "field_added:post:format";
/** What the server says of the three field changes: 148 entries have 요약 (renamed), 132 have 부제 and 148 lack the new required 글 종류. */
const fieldChanges = previewOf({
	impacts: [
		{
			change: change("field_removed", { field: "summary", fieldKind: "text" }),
			key: RENAME,
			entries: 148,
			sample: SAMPLE,
			consequence: "orphaned",
			checked: true,
		},
		{
			change: change("field_added", { field: "excerpt", fieldKind: "text", required: false }),
			key: "field_added:post:excerpt",
			entries: 0,
			sample: [],
			consequence: "none",
			checked: true,
		},
		{
			change: change("field_removed", { field: "subtitle", fieldKind: "text" }),
			key: SUBTITLE,
			entries: 132,
			sample: SAMPLE,
			consequence: "orphaned",
			checked: true,
		},
		{
			change: change("field_added", { field: "format", fieldKind: "select", required: true }),
			key: FORMAT,
			entries: 148,
			sample: SAMPLE,
			consequence: "publish_blocked",
			checked: true,
		},
	],
	decisions: [
		{
			key: RENAME,
			change: change("field_removed", { field: "summary", fieldKind: "text" }),
			entries: 148,
			sample: SAMPLE,
			suggestions: [renameField],
			chosen: renameField,
		},
		{
			key: SUBTITLE,
			change: change("field_removed", { field: "subtitle", fieldKind: "text" }),
			entries: 132,
			sample: SAMPLE,
			suggestions: [dropSubtitle],
			chosen: null,
		},
		{
			key: FORMAT,
			change: change("field_added", { field: "format", fieldKind: "select", required: true }),
			entries: 148,
			sample: SAMPLE,
			suggestions: [fill("note"), fill("essay"), fill("review")],
			chosen: fill("note"),
		},
	],
});

/** Stage 필드 검토: one block per change, the values kept, moved or deleted, and the entries touched. */
export const FieldsReview = story(server({ preview: fieldChanges }), "collections", FIELDS, {
	play: steps(preview(false), changeFields, async ({ canvasElement }) => {
		const sheet = await openReview(canvasElement);
		await within(sheet).findByTestId(`impact-${RENAME}`);
	}),
});

/** Stage 값 지우기: choosing to delete the values turns the apply into the red 지우고 적용. */
export const FieldsReviewDrop = story(server({ preview: fieldChanges }), "collections", FIELDS, {
	play: steps(preview(false), changeFields, async ({ canvasElement }) => {
		const sheet = await openReview(canvasElement);
		const block = await within(sheet).findByTestId(`impact-${SUBTITLE}`);
		await click(within(block).getByRole("radio", { name: new RegExp(tReview("choice.erase")) }));
		await within(sheet).findByRole("button", { name: tReview("drop.apply") });
	}),
});

/** Stage 충돌: the file changed since the page opened; the review says so and the apply is off. */
export const FieldsReviewConflict = story(
	server({
		preview: fieldChanges,
		save: answer(409, { error: { code: "schema_conflict", message: "The file changed." } }),
	}),
	"collections",
	FIELDS,
	{
		play: steps(preview(false), changeFields, async ({ canvasElement }) => {
			const sheet = await openReview(canvasElement);
			await click(within(sheet).getByRole("button", { name: tReview("review.save") }));
			await within(sheet).findByText(tReview("save.conflict.title"));
		}),
	},
);

/** Stage 적용 실패: the file is saved but applying it to the database failed; the page says so with the two ways on. */
export const FieldsApplyFailed = story(
	server({
		preview: fieldChanges,
		save: answer(500, { error: { code: "schema_apply_failed", message: "connect ECONNREFUSED 127.0.0.1:5432" } }),
	}),
	"collections",
	FIELDS,
	{
		play: steps(preview(false), changeFields, async ({ canvasElement }) => {
			const sheet = await openReview(canvasElement);
			await click(within(sheet).getByRole("button", { name: tReview("review.save") }));
			await find(canvasElement).findByText(tReview("applyFailed.title"));
			unfocus();
		}),
	},
);

// ----- the public address (steps 13-14) -----

const editPath: Play = async ({ canvasElement }) => {
	setValue(await find(canvasElement).findByRole("textbox", { name: tCollection("collection.path") }), "blog");
};

/** Stage 주소 바꿈: the new address marks its label and counts one change. */
export const PathChanged = story(server(), "collections", BASICS, { play: editPath });

const pathReview = previewOf({
	impacts: [
		{
			change: { kind: "collection_path_changed", collection: "post", from: "/posts/:slug", to: "/blog/:slug" },
			key: "collection_path_changed:post:/posts/:slug:/blog/:slug",
			entries: 148,
			sample: SAMPLE,
			consequence: "address_changed",
			checked: true,
		},
	],
});

/** Stage 주소 검토: before and after, and how many published entries change address. */
export const PathReview = story(server({ preview: pathReview }), "collections", BASICS, {
	play: steps(editPath, async ({ canvasElement }) => {
		await openReview(canvasElement);
	}),
});

// ----- deleting a collection (steps 15-19) -----

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
		unlinked: { count: 4, sample: [SAMPLE[0]] },
		bodyLinks: 2,
	},
};
/** The server of the delete: the review names what goes and the four entries whose links are cut when it is applied. */
const deleteServer: FakeApi = (path, method) => {
	if (path === SCHEMA && method === "GET") return screenState();
	if (path === `${SCHEMA}/preview`)
		return previewOf({
			impacts: [memoRemoval],
			transforms: [{ id: "drop-memo", op: "dropCollection", collection: "memo" }],
		});
	return undefined;
};
const MEMO = { collection: "memo", section: "basics" };
const pressDelete: Play = async ({ canvasElement }) => {
	const block = await find(canvasElement).findByTestId("collection-delete");
	await click(within(block).getByRole("button", { name: tCollection("collection.delete") }));
};

/** Stage 지우기 전 (step 15): the block at the bottom of the basics tab, with what the collection holds. */
export const DeleteBefore = story(deleteServer, "collections", MEMO);

/** Stage 지울 예정 (step 16): gone from the list at once, the changes menu open with the row, and the toast. */
export const DeletePending = story(deleteServer, "collections", MEMO, {
	play: steps(pressDelete, async ({ canvasElement }) => {
		await click(await changesButton(canvasElement));
		await body().findByRole("menuitem", { name: new RegExp(t("bar.removed")) });
	}),
});

/** Stage 지우기 검토 (step 17): what goes, what is cut and what breaks; 지우고 적용 is on from the start. */
export const DeleteReview = story(deleteServer, "collections", MEMO, {
	play: steps(pressDelete, async ({ canvasElement }) => {
		// The board's review has no toast: it belongs to the moment of the press.
		toast.dismiss();
		const sheet = await openReview(canvasElement, tReview("drop.apply"));
		await within(sheet).findByTestId("impact-collection_removed:memo");
	}),
});

/** Stage 지운 뒤 (step 19): the collection is gone from the list, and the toast says what went. */
export const DeleteDone = story(
	(path, method) => {
		if (path === SCHEMA && method === "GET") {
			const base = screenState();
			const { memo: _memo, ...collections } = base.schema.collections;
			return {
				...base,
				schema: { ...base.schema, collections },
				collections: ["post", "category", "tag", "series"],
			};
		}
		return undefined;
	},
	"collections",
	BASICS,
	{ before: () => rememberSaved(t("save.done")) },
);

// ----- the file cannot be edited here -----

/** Stage 읽기 전용: the basics tab with the lock beside 구조 and no way to change or delete. */
export const ReadOnly = story(server({ state: readOnlyState() }), "collections", BASICS);

/** Stage 읽기 전용 필드: a field opened in the sheet, with its settings as text. */
export const ReadOnlyField = story(server({ state: readOnlyState() }), "collections", FIELDS, {
	play: steps(preview(false), async ({ canvasElement }) => {
		await click(await find(canvasElement).findByRole("button", { name: tFields("field.toggle", { name: "summary" }) }));
		await body().findByRole("dialog");
	}),
});
