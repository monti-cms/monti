import type { ListEntriesItem } from "@monti-cms/core/site";
import { describe, expect, it, vi } from "vitest";
import { commonMessages } from "../../lib/common.messages";
import { bulkBarMessages } from "../entries/bulk-bar.messages";
import { exportMessages } from "../export/messages";
import { actionTargets, type RowMenuContext, type RowMenuHandlers, rowMenuActions } from "../list-row-menu";
import { screensMessages } from "../messages";
import type { MenuAction } from "../shared/action-menu";
import { listSite } from "./list-site";

// The local site's `story` has two relations a bulk change can reach (`deskId`, `labelIds`), a backlink and a relation inside a conditional branch.
const site = listSite();
const t = site.createTranslator(screensMessages);
const tc = site.createTranslator(commonMessages);
const tBulk = site.createTranslator(bulkBarMessages);
const OPEN = tc("open");
const DUPLICATE = tc("lifecycle.duplicate");
const PUBLISH = tc("lifecycle.publish");
const ARCHIVE = tc("lifecycle.archive");
const UNARCHIVE = tc("lifecycle.unarchive");
const TRASH = tc("lifecycle.trash");
const TO_FOLDER = t("menu.moveToFolder");
const EXPORT = site.createTranslator(exportMessages)("action.selected");
const DESK = site.storedField("story", "deskId")?.field.label as string;
const LABELS = site.storedField("story", "labelIds")?.field.label as string;
/** The folder the test gives the list. */
const FOLDER = "뉴스";

const item = (id: string, status: ListEntriesItem["status"] = "draft", changed = false) =>
	({ id, title: id, status, version: 2, hasUnpublishedChanges: changed, relations: {} }) as ListEntriesItem;
const context: RowMenuContext = {
	isRecord: false,
	isContent: true,
	folders: [{ id: "f1", collection: "story", parentId: null, name: FOLDER, position: 0, version: 1 }],
	collection: "story",
};
const handlers = (): RowMenuHandlers => ({
	openEditor: vi.fn(),
	openInNewTab: vi.fn(),
	openRecord: vi.fn(),
	duplicate: vi.fn(),
	confirmPublish: vi.fn(),
	exportEntries: vi.fn(),
	confirmTrash: vi.fn(),
	confirmArchive: vi.fn(),
	bulk: vi.fn(),
});
const labels = (actions: MenuAction[]) => actions.map((action) => ("label" in action ? action.label : "—"));
const select = (actions: MenuAction[], ...path: string[]) => {
	let current = actions;
	for (const [index, label] of path.entries()) {
		const found = current.find((action) => "label" in action && action.label === label);
		if (!found) throw new Error(`no ${label}`);
		if (index === path.length - 1 && found.kind === "item") return found.onSelect();
		if (found.kind === "sub") current = found.items;
	}
};

describe("row menu target", () => {
	const rows = [item("a"), item("b"), item("c")];

	it("LIST-C5 pressing one of the selected rows targets all selected rows", () => {
		expect(actionTargets(rows[1] as ListEntriesItem, rows, new Set(["a", "b"])).map((row) => row.id)).toEqual([
			"a",
			"b",
		]);
	});

	it("LIST-C5 an unselected row, or the only selected row, targets just that row", () => {
		expect(actionTargets(rows[2] as ListEntriesItem, rows, new Set(["a", "b"])).map((row) => row.id)).toEqual(["c"]);
		expect(actionTargets(rows[0] as ListEntriesItem, rows, new Set(["a"])).map((row) => row.id)).toEqual(["a"]);
	});
});

describe("row menu items", () => {
	it("LIST-C5 offers moving to a folder only where the list has folders", () => {
		const withFolders = labels(rowMenuActions(site, [item("a")], context, handlers()));
		const without = labels(rowMenuActions(site, [item("a")], { ...context, folders: null }, handlers()));
		expect(withFolders).toContain(TO_FOLDER);
		expect(without).not.toContain(TO_FOLDER);
		// An empty folder list is still a list with folders: the move offers the top level.
		expect(labels(rowMenuActions(site, [item("a")], { ...context, folders: [] }, handlers()))).toContain(TO_FOLDER);
	});

	it("LIST-C5 a single entry row offers open and duplicate, the folder and each relation field it can change, archive and the trash", () => {
		const list = labels(rowMenuActions(site, [item("a")], context, handlers()));
		for (const label of [OPEN, DUPLICATE, TO_FOLDER, DESK, LABELS, ARCHIVE, TRASH]) {
			expect(list).toContain(label);
		}
		// The fields are rows of their own, not an "add a label" row, and the destructive action comes last.
		expect(list).not.toContain(tBulk("relation.add", { label: LABELS }));
		expect(list.indexOf(TO_FOLDER)).toBeLessThan(list.indexOf(DESK));
		expect(list.indexOf(LABELS)).toBeLessThan(list.indexOf(ARCHIVE));
		expect(list.at(-1)).toBe(TRASH);
	});

	it("LIST-C4 offers only the relation fields a bulk change can reach: not a backlink, not a field inside a conditional branch", () => {
		const fields = rowMenuActions(site, [item("a")], context, handlers()).filter((action) => action.kind === "choice");
		expect(labels(fields)).toEqual([DESK, LABELS]);
	});

	it("LIST-C5 multiple rows show the item count first and have no open or duplicate", () => {
		const list = labels(rowMenuActions(site, [item("a"), item("b")], context, handlers()));
		expect(list[0]).toBe(t("menu.items", { count: 2 }));
		expect(list).not.toContain(OPEN);
		expect(list).not.toContain(DUPLICATE);
	});

	it("LIST-C5 several rows list publish, archive, the folder, the fields, export and the trash in that order, with the fields at the second level", () => {
		const list = labels(rowMenuActions(site, [item("a"), item("b")], context, handlers()));
		expect(list.filter((label) => label !== "—")).toEqual([
			t("menu.items", { count: 2 }),
			PUBLISH,
			ARCHIVE,
			TO_FOLDER,
			DESK,
			LABELS,
			EXPORT,
			TRASH,
		]);
		expect(list).not.toContain(tBulk("change"));
	});

	it("LIST-C5 leaves publish out when every row is published without changes, and keeps it for a published row with changes", () => {
		const published = [item("a", "published"), item("b", "published")];
		expect(labels(rowMenuActions(site, published, context, handlers()))).not.toContain(PUBLISH);
		const editing = [item("a", "published"), item("b", "published", true)];
		expect(labels(rowMenuActions(site, editing, context, handlers()))).toContain(PUBLISH);
	});

	it("LIST-C5 publish asks, and export opens the export of the rows", () => {
		const on = handlers();
		const actions = rowMenuActions(site, [item("a"), item("b")], context, on);
		select(actions, PUBLISH);
		expect(on.confirmPublish).toHaveBeenCalledWith([
			expect.objectContaining({ id: "a" }),
			expect.objectContaining({ id: "b" }),
		]);
		select(actions, EXPORT);
		expect(on.exportEntries).toHaveBeenCalledWith(["a", "b"]);
	});

	it("LIST-C5 several archived rows offer to take the archive off instead", () => {
		const list = labels(rowMenuActions(site, [item("a", "archived"), item("b", "archived")], context, handlers()));
		expect(list).toContain(UNARCHIVE);
		expect(list).not.toContain(ARCHIVE);
		expect(list).not.toContain(PUBLISH);
	});

	it("LIST-C5 rows that are all archived offer unarchive", () => {
		const on = handlers();
		select(rowMenuActions(site, [item("a", "archived")], context, on), UNARCHIVE);
		expect(on.bulk).toHaveBeenCalledWith("unarchive", UNARCHIVE, [
			expect.objectContaining({ id: "a", expectedVersion: 2, title: "a" }),
		]);
	});

	it("LIST-C5 archive asks for confirmation instead of acting right away", () => {
		const on = handlers();
		select(rowMenuActions(site, [item("a")], context, on), ARCHIVE);
		expect(on.confirmArchive).toHaveBeenCalledWith([
			expect.objectContaining({ id: "a", expectedVersion: 2, title: "a" }),
		]);
		expect(on.bulk).not.toHaveBeenCalled();
	});

	it("LIST-C5 a taxonomy item opens as a small form and has no archive", () => {
		const on = handlers();
		const actions = rowMenuActions(site, [item("a")], { ...context, isRecord: true, isContent: false }, on);
		const list = labels(actions);
		expect(list).toContain(OPEN);
		expect(list).not.toContain(ARCHIVE);
		select(actions, OPEN);
		expect(on.openRecord).toHaveBeenCalledWith(item("a"));
	});

	it("LIST-C5 the folder submenu calls the bulk action with the chosen targets and folder", () => {
		const on = handlers();
		const actions = rowMenuActions(site, [item("a"), item("b")], context, on);
		const targets = [
			expect.objectContaining({ id: "a", expectedVersion: 2, title: "a" }),
			expect.objectContaining({ id: "b", expectedVersion: 2, title: "b" }),
		];
		select(actions, TO_FOLDER, t("menu.root"));
		select(actions, TO_FOLDER, FOLDER);
		expect(on.bulk).toHaveBeenNthCalledWith(1, "folder.move", t("bulk.move"), targets, { folderId: null });
		expect(on.bulk).toHaveBeenNthCalledWith(2, "folder.move", t("bulk.move"), targets, { folderId: "f1" });
	});
});
