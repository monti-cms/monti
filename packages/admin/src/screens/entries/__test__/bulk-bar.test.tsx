import type { CmsConfig } from "@monti-cms/core";
import type { Folder } from "@monti-cms/core/site";
import { createSite } from "@monti-cms/core/site";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../../core/test/site";
import { commonMessages } from "../../../lib/common.messages";
import { renderWithSite as render } from "../../../test/site";
import { BulkBar, bulkActionsFor } from "../bulk-bar";
import { bulkBarMessages } from "../bulk-bar.messages";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const t = testSite.createTranslator(bulkBarMessages);
const tc = testSite.createTranslator(commonMessages);

const selected = [{ id: "entry-1", expectedVersion: 3, title: "첫 글", status: "draft" as const }];
const folders: Folder[] = [
	{ id: "folder-1", collection: "post", parentId: null, name: "Folder One", position: 0, version: 1 },
];

/** The taxonomy options the bar's menus list come from the entries API. */
function stubApi() {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.startsWith("/api/monti/v1/entries?")) {
				const items = url.includes("collection=tag")
					? [{ id: "tag-1", title: "Tag One", slug: "tag-one" }]
					: url.includes("collection=category")
						? [{ id: "cat-1", title: "Cat One", slug: "cat-one" }]
						: [];
				return { ok: true, status: 200, json: async () => ({ items, total: items.length }) };
			}
			if (url === "/api/monti/v1/meta") return { ok: true, status: 200, json: async () => ({ formats: [] }) };
			if (url === "/api/monti/v1/export/summary") {
				return {
					ok: true,
					status: 200,
					json: async () => ({
						scope: "admin",
						entries: 1,
						addedByTranslations: 0,
						notPublished: 0,
						notFound: 0,
						templates: 0,
						folders: 0,
						addresses: 0,
						media: 0,
					}),
				};
			}
			throw new Error(`Unexpected fetch: ${url}`);
		}),
	);
}

const bar = (props: Partial<Parameters<typeof BulkBar>[0]> = {}) => {
	const onRun = vi.fn(async () => undefined);
	const onClearSelection = vi.fn();
	render(
		<BulkBar
			collection="post"
			selected={selected}
			folders={folders}
			onClearSelection={onClearSelection}
			onRun={onRun}
			{...props}
		/>,
	);
	return { onRun, onClearSelection };
};

/** Bulk actions always ask. Checks the confirm dialog's question and presses confirm. */
async function confirmIn(label: string, question: string) {
	const dialog = await screen.findByRole("alertdialog", { name: label });
	expect(within(dialog).getByText(question)).toBeTruthy();
	fireEvent.click(within(dialog).getByRole("button", { name: label }));
	await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
}

const openMore = async () => {
	fireEvent.click(screen.getByRole("button", { name: t("more") }));
	return screen.findAllByRole("menuitem");
};

describe("what the bar offers", () => {
	const site = testSite;
	const ask = (over: Partial<Parameters<typeof bulkActionsFor>[0]> = {}) =>
		bulkActionsFor({ site, collection: "post", mode: "list", selected, hasFolders: true, ...over });

	it("puts publish and the folder first and the rest in the menu, with the trash last", () => {
		const { primary, more } = ask();
		expect(primary).toEqual(["publish", "folder.move"]);
		expect(more.at(-1)).toBe("trash");
		expect(more).toContain("export");
	});

	it("leaves out what cannot be done to the rows picked", () => {
		const archived = [{ ...selected[0], status: "archived" as const }];
		expect(ask({ selected: archived }).primary).toEqual(["folder.move"]);
		expect(ask({ selected: archived }).more).toContain("unarchive");
		expect(ask({ selected: archived }).more).not.toContain("archive");
		expect(ask().more).toContain("archive");
		expect(ask().more).not.toContain("unarchive");
		expect(ask({ hasFolders: false }).primary).toEqual(["publish"]);
	});

	it("gives an item collection only what an item can have done: export and trash, and a folder where it has them", () => {
		expect(ask({ collection: "tag", hasFolders: false })).toEqual({ primary: [], more: ["export", "trash"] });
		expect(ask({ collection: "tag", hasFolders: true }).primary).toEqual(["folder.move"]);
	});

	it("gives the trash only the permanent delete", () => {
		expect(ask({ mode: "trash" })).toEqual({ primary: ["permanentDelete"], more: [] });
	});
});

describe("the bar over picked rows", () => {
	it("says how many are picked, and lets go with one press", () => {
		stubApi();
		const { onClearSelection } = bar();
		expect(screen.getByRole("toolbar", { name: t("count", { count: 1 }) })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: t("clear") }));
		expect(onClearSelection).toHaveBeenCalled();
	});

	it("draws nothing while no row is picked, and has no request to the assistant yet", () => {
		stubApi();
		bar({ selected: [] });
		expect(screen.queryByRole("toolbar")).toBeNull();
		cleanup();
		bar();
		expect(screen.queryByRole("button", { name: /요청|request/i })).toBeNull();
	});

	it("publishes after asking", async () => {
		stubApi();
		const { onRun } = bar();
		fireEvent.click(screen.getByRole("button", { name: tc("lifecycle.publish") }));
		await confirmIn(tc("lifecycle.publish"), t("ask.publish", { count: 1, noun: "게시글" }));
		await waitFor(() => expect(onRun).toHaveBeenCalledTimes(1));
		expect(onRun).toHaveBeenCalledWith("publish", tc("lifecycle.publish"), selected, {});
	});

	it("moves to the top level or to a folder from the folder menu, after asking", async () => {
		stubApi();
		const { onRun } = bar();
		fireEvent.click(screen.getByRole("button", { name: t("folder.move") }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("option.root") }));
		await confirmIn(t("folder.move"), t("ask.folder.root", { count: 1 }));
		await waitFor(() => expect(onRun).toHaveBeenCalledTimes(1));
		expect(onRun).toHaveBeenLastCalledWith("folder.move", t("folder.move"), selected, { folderId: null });

		fireEvent.click(screen.getByRole("button", { name: t("folder.move") }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "Folder One" }));
		await confirmIn(t("folder.move"), t("ask.folder.move", { count: 1, target: "Folder One" }));
		await waitFor(() => expect(onRun).toHaveBeenCalledTimes(2));
		expect(onRun).toHaveBeenLastCalledWith("folder.move", t("folder.move"), selected, { folderId: "folder-1" });
	});

	it("adds a tag and clears a category from the menu, picking and applying in one step", async () => {
		stubApi();
		const { onRun } = bar();
		await openMore();
		const addTag = await screen.findByRole("menuitem", { name: t("relation.add", { label: "태그" }) });
		fireEvent.keyDown(addTag, { key: "ArrowRight" });
		fireEvent.click(await screen.findByRole("menuitem", { name: "Tag One" }));
		await confirmIn(
			t("relation.add", { label: "태그" }),
			t("ask.relation.add", { label: "태그", target: "Tag One", count: 1, noun: "게시글" }),
		);
		await waitFor(() => expect(onRun).toHaveBeenCalledTimes(1));
		expect(onRun).toHaveBeenLastCalledWith("relation.add", t("relation.add", { label: "태그" }), selected, {
			field: "tagIds",
			ids: ["tag-1"],
		});

		await openMore();
		const setCategory = await screen.findByRole("menuitem", { name: t("relation.set", { label: "카테고리" }) });
		fireEvent.keyDown(setCategory, { key: "ArrowRight" });
		fireEvent.click(await screen.findByRole("menuitem", { name: t("option.none") }));
		await confirmIn(
			t("relation.set", { label: "카테고리" }),
			t("ask.relation.clear", { label: "카테고리", count: 1, noun: "게시글" }),
		);
		await waitFor(() => expect(onRun).toHaveBeenCalledTimes(2));
		expect(onRun).toHaveBeenLastCalledWith("relation.set", t("relation.set", { label: "카테고리" }), selected, {
			field: "categoryId",
			id: null,
		});
	});

	it("keeps the trash last in the menu, in red, behind a confirmation", async () => {
		stubApi();
		const { onRun } = bar();
		const rows = await openMore();
		const trash = rows.at(-1) as HTMLElement;
		expect(trash.textContent).toBe(tc("lifecycle.trash"));
		expect(trash.getAttribute("data-variant")).toBe("danger");
		fireEvent.click(trash);
		await screen.findByRole("alertdialog", { name: tc("lifecycle.trash") });
		expect(onRun).not.toHaveBeenCalled();
		fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: tc("lifecycle.trash") }));
		await waitFor(() => expect(onRun).toHaveBeenCalledTimes(1));
		expect(onRun).toHaveBeenCalledWith("trash", tc("lifecycle.trash"), selected, {});
	});

	it("exports the picked rows: it opens the export dialog instead of changing them", async () => {
		stubApi();
		const { onRun } = bar();
		const rows = await openMore();
		fireEvent.click(
			rows.find(
				(row) => row.textContent !== tc("lifecycle.trash") && /내보내기|Export/.test(row.textContent ?? ""),
			) as HTMLElement,
		);
		const dialog = await screen.findByRole("dialog");
		expect(await within(dialog).findByTestId("export-headline")).toBeTruthy();
		expect(onRun).not.toHaveBeenCalled();
	});

	it("has the folder button for a list with folders and not for one without", () => {
		stubApi();
		bar({ folders: null });
		expect(screen.queryByRole("button", { name: t("folder.move") })).toBeNull();
		cleanup();
		bar();
		expect(screen.getByRole("button", { name: t("folder.move") })).toBeTruthy();
	});

	it("offers an item collection that has folders the folder move, and no publishing", () => {
		stubApi();
		const site = createSite({
			...testConfig,
			collections: { ...testConfig.collections, tag: { ...testConfig.collections.tag, folders: true } },
		} as CmsConfig);
		render(
			<BulkBar collection="tag" selected={selected} folders={folders} onClearSelection={vi.fn()} onRun={vi.fn()} />,
			{ site },
		);
		expect(screen.getByRole("button", { name: t("folder.move") })).toBeTruthy();
		expect(screen.queryByRole("button", { name: tc("lifecycle.publish") })).toBeNull();
	});

	it("permanently deletes in the trash after asking, and has no menu", async () => {
		stubApi();
		const { onRun } = bar({ mode: "trash", folders: [] });
		expect(screen.queryByRole("button", { name: t("more") })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: tc("lifecycle.deletePermanently") }));
		await screen.findByRole("alertdialog", { name: tc("lifecycle.deletePermanently") });
		fireEvent.click(
			within(screen.getByRole("alertdialog")).getByRole("button", { name: tc("lifecycle.deletePermanently") }),
		);
		await waitFor(() => expect(onRun).toHaveBeenCalledTimes(1));
		expect(onRun).toHaveBeenCalledWith("permanentDelete", tc("lifecycle.deletePermanently"), selected, {});
	});
});
