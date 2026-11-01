import type { BulkOp, Folder, ListEntriesItem } from "@monti-cms/core/site";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { BulkParams } from "../../../api/entries";
import { commonMessages } from "../../../lib/common.messages";
import { fakeApi } from "../../../test/fake-api";
import { renderWithSite as render } from "../../../test/site";
import { exportMessages } from "../../export/messages";
import { deleteMessages } from "../../shared/delete.messages";
import { BulkBar } from "../bulk-bar";
import { bulkBarMessages } from "../bulk-bar.messages";
import { toSelection } from "../bulk-model";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const t = testSite.createTranslator(bulkBarMessages);
const tc = testSite.createTranslator(commonMessages);
const td = testSite.createTranslator(deleteMessages);
const tx = testSite.createTranslator(exportMessages);

const row = (id: string, patch: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: "post",
	locale: "ko",
	translationGroupId: id,
	title: id,
	slug: id,
	status: "draft",
	version: 3,
	folderId: null,
	relations: {},
	values: {},
	hasUnpublishedChanges: false,
	publishedAt: null,
	createdAt: new Date(0),
	updatedAt: new Date(0),
	deletedAt: null,
	...patch,
});
const tags = (...names: string[]) => ({ tagIds: names.map((name) => ({ id: `tag-${name}`, title: name })) });
const folders: Folder[] = [
	{ id: "folder-1", collection: "post", parentId: null, name: "Folder One", position: 0, version: 1 },
];
const picked = [row("entry-1")];

const TAGS = ["리액트", "성능", "타입스크립트"].map((title) => ({
	id: `tag-${title}`,
	title,
	slug: title,
	status: "published",
}));
const CATEGORIES = [{ id: "cat-1", title: "개발", slug: "dev", status: "published" }];

/** The entries the menus search (`/entries/search`), and what the export dialog asks for. */
function stubApi() {
	fakeApi()
		.on("GET /v1/entries/search", ({ query }) => {
			const all = query.get("collection") === "category" ? CATEGORIES : TAGS;
			const ids = query.getAll("id");
			const text = query.get("query") ?? "";
			return {
				items:
					ids.length > 0
						? all.filter((item) => ids.includes(item.id))
						: all.filter((item) => item.title.includes(text)),
			};
		})
		.install();
}

type Run = (op: BulkOp, label: string, targets: ReturnType<typeof toSelection>[], params?: BulkParams) => Promise<void>;

/** The bar in a table, over rows the test holds in state; `onRun` changes the rows' tags the way a bulk request would. */
function Bar({
	initial = picked,
	collection = "post",
	hasFolders = true,
	run,
	onExport = vi.fn(),
	onClear = vi.fn(),
}: {
	initial?: ListEntriesItem[];
	collection?: string;
	hasFolders?: boolean;
	run: Run;
	onExport?: (ids: string[]) => void;
	onClear?: () => void;
}) {
	const [rows, setRows] = useState(initial);
	const onRun: Run = async (op, label, targets, params) => {
		await run(op, label, targets, params);
		if (!params?.field) return;
		const field = params.field;
		setRows((now) =>
			now.map((entry) => {
				const held = entry.relations[field] ?? [];
				const named = (id: string) => ({ id, title: id.replace("tag-", "") });
				if (op === "relation.add")
					return {
						...entry,
						relations: {
							...entry.relations,
							[field]: [
								...held,
								...(params.ids ?? []).filter((id) => !held.some((value) => value.id === id)).map(named),
							],
						},
					};
				if (op === "relation.remove")
					return {
						...entry,
						relations: { ...entry.relations, [field]: held.filter((value) => !(params.ids ?? []).includes(value.id)) },
					};
				return { ...entry, relations: { ...entry.relations, [field]: params.id ? [named(params.id)] : [] } };
			}),
		);
	};
	return (
		<table>
			<BulkBar
				collection={collection}
				rows={rows}
				folders={hasFolders ? folders : null}
				colSpan={3}
				onClearSelection={onClear}
				onRun={onRun}
				onExport={onExport}
			/>
		</table>
	);
}

const bar = (props: Partial<Parameters<typeof Bar>[0]> = {}) => {
	stubApi();
	const run = vi.fn<Run>(async () => undefined);
	const onExport = vi.fn();
	const onClear = vi.fn();
	render(<Bar run={run} onExport={onExport} onClear={onClear} {...props} />);
	return { run, onExport, onClear };
};

/** Bulk actions that change many things at once ask first. Checks the confirm dialog's question and presses confirm. */
async function confirmIn(label: string, question: string) {
	const dialog = await screen.findByRole("alertdialog", { name: label });
	expect(within(dialog).getByText(question)).toBeInTheDocument();
	fireEvent.click(within(dialog).getByRole("button", { name: label }));
	await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
}

const openMore = async () => {
	fireEvent.click(screen.getByRole("button", { name: t("more") }));
	return screen.findAllByRole("menuitem");
};
/** Opens 바꾸기 and one of its fields, whose values are the second level. */
const openField = async (label: string) => {
	fireEvent.click(screen.getByRole("button", { name: t("change") }));
	fireEvent.keyDown(await screen.findByRole("menuitem", { name: label }), { key: "ArrowRight" });
};
const names = () => screen.getAllByRole("button").map((button) => button.textContent?.trim());

describe("the bar over picked rows", () => {
	it("LIST-C5 shows publish, archive, the folder and 바꾸기 as buttons", () => {
		bar();
		expect(names()).toEqual(
			expect.arrayContaining([tc("lifecycle.publish"), tc("lifecycle.archive"), t("folder.move"), t("change")]),
		);
	});

	it("LIST-C5 publishes after asking", async () => {
		const { run } = bar();
		fireEvent.click(screen.getByRole("button", { name: tc("lifecycle.publish") }));
		await confirmIn(tc("lifecycle.publish"), t("ask.publish", { count: 1, noun: "게시글" }));
		await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
		expect(run).toHaveBeenCalledWith("publish", tc("lifecycle.publish"), picked.map(toSelection), {});
	});

	it("LIST-C5 moves to the top level or to a folder from the folder menu, after asking", async () => {
		const { run } = bar();
		fireEvent.click(screen.getByRole("button", { name: t("folder.move") }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("option.root") }));
		await confirmIn(t("folder.move"), t("ask.folder.root", { count: 1 }));
		await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
		expect(run).toHaveBeenLastCalledWith("folder.move", t("folder.move"), picked.map(toSelection), { folderId: null });

		fireEvent.click(screen.getByRole("button", { name: t("folder.move") }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "Folder One" }));
		await confirmIn(t("folder.move"), t("ask.folder.move", { count: 1, target: "Folder One" }));
		await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
		expect(run).toHaveBeenLastCalledWith("folder.move", t("folder.move"), picked.map(toSelection), {
			folderId: "folder-1",
		});
	});

	it("LIST-C5 keeps export and then the trash in the ⋯, the trash in red, and moves drafts at once", async () => {
		const { run, onExport } = bar();
		await openMore();
		fireEvent.click(screen.getByRole("menuitem", { name: tx("action.selected") }));
		expect(onExport).toHaveBeenCalledWith(["entry-1"]);
		expect(run).not.toHaveBeenCalled();
		await openMore();
		fireEvent.click(screen.getByRole("menuitem", { name: tc("lifecycle.trash") }));
		await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
		expect(screen.queryByRole("alertdialog")).toBeNull();
		// The bar passes no parameters for the trash.
		expect(run).toHaveBeenCalledWith("trash", tc("lifecycle.trash"), picked.map(toSelection), undefined);
	});

	it("TRASH-T3 asks before moving a published entry to the trash, and sends nothing when cancelled", async () => {
		const { run } = bar({ initial: [row("entry-1", { status: "published" })] });
		await openMore();
		fireEvent.click(screen.getByRole("menuitem", { name: tc("lifecycle.trash") }));
		const dialog = await screen.findByRole("alertdialog", { name: td("trash.ask.title") });
		expect(within(dialog).getByText(td("trash.ask.one", { title: "entry-1" }))).toBeInTheDocument();
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(run).not.toHaveBeenCalled();

		await openMore();
		fireEvent.click(screen.getByRole("menuitem", { name: tc("lifecycle.trash") }));
		fireEvent.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", { name: td("trash.ask.confirm") }),
		);
		await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
	});
});

describe("바꾸기: the relation fields of the picked rows", () => {
	/** Two rows: both hold 리액트, only the first holds 성능. */
	const two = [row("a", { relations: tags("리액트", "성능") }), row("b", { relations: tags("리액트") })];
	const item = (name: string) => screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${name}`) });

	it("LIST-C4 shows a tag every picked row holds as ticked, one only some hold as mixed with how many, and the others empty", async () => {
		bar({ initial: two });
		await openField("태그");
		expect((await item("리액트")).getAttribute("aria-checked")).toBe("true");
		const mixed = await item("성능");
		expect(mixed.getAttribute("aria-checked")).toBe("mixed");
		expect(within(mixed).getByLabelText(t("holding", { count: 1, total: 2 })).textContent).toBe("1/2");
		expect((await item("타입스크립트")).getAttribute("aria-checked")).toBe("false");
	});

	it("LIST-C4 adds an empty tag to all, and takes a ticked tag off all of them", async () => {
		const { run } = bar({ initial: two });
		await openField("태그");
		fireEvent.click(await item("타입스크립트"));
		await waitFor(() =>
			expect(run).toHaveBeenLastCalledWith("relation.add", expect.anything(), expect.anything(), {
				field: "tagIds",
				ids: ["tag-타입스크립트"],
			}),
		);
		fireEvent.click(await item("리액트"));
		await waitFor(() =>
			expect(run).toHaveBeenLastCalledWith(
				"relation.remove",
				t("relation.remove", { label: "태그" }),
				two.map(toSelection),
				{
					field: "tagIds",
					ids: ["tag-리액트"],
				},
			),
		);
		await waitFor(async () => expect((await item("리액트")).getAttribute("aria-checked")).toBe("false"));
	});

	it("LIST-F7 narrows the values to what the search row finds", async () => {
		bar({ initial: two });
		await openField("태그");
		await item("성능");
		fireEvent.change(await screen.findByRole("textbox", { name: t("search", { label: "태그" }) }), {
			target: { value: "타입" },
		});
		await waitFor(() => expect(screen.queryByRole("menuitemcheckbox", { name: /^성능/ })).toBeNull());
		expect(screen.getByRole("menuitemcheckbox", { name: /^타입스크립트/ })).toBeInTheDocument();
	});

	it("LIST-C4 sets a one-value field on all the rows in one pick, which closes the menu", async () => {
		const { run } = bar({ initial: two });
		await openField("카테고리");
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "개발" }));
		await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
		expect(run).toHaveBeenCalledWith("relation.set", t("relation.set", { label: "카테고리" }), two.map(toSelection), {
			field: "categoryId",
			id: "cat-1",
		});
		await waitFor(() => expect(screen.queryAllByRole("menu")).toHaveLength(0));
	});

	it("LIST-C4 puts the ✓ on the value every picked row shares, and has no 'none' for a required field", async () => {
		const category = { id: "cat-1", title: "개발" };
		bar({
			initial: [
				row("a", { relations: { categoryId: [category] } }),
				row("b", { relations: { categoryId: [category] } }),
			],
		});
		await openField("카테고리");
		expect((await screen.findByRole("menuitemradio", { name: "개발" })).getAttribute("aria-checked")).toBe("true");
		expect(screen.queryByRole("menuitemradio", { name: t("option.none") })).toBeNull();
	});
});
