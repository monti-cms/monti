import type { BulkOp, Site } from "@monti-cms/core/client";
import type { Folder, ListEntriesItem } from "@monti-cms/core/runtime";
import type { BulkSelection, runBulk } from "./entries/bulk-bar.js";
import type { MenuAction } from "./shared/action-menu.js";
import type { TaxonomyOptions } from "./shared/use-taxonomy.js";
export type BulkParams = NonNullable<Parameters<typeof runBulk>[3]>;
export declare const toSelection: (item: ListEntriesItem) => BulkSelection;
/**
 * Target of right-click / Delete key. If the pressed row is one of the selected rows and two or more are selected, all selected rows; otherwise just that row.
 */
export declare function actionTargets(item: ListEntriesItem, items: readonly ListEntriesItem[], selectedIds: ReadonlySet<string>): ListEntriesItem[];
export interface RowMenuContext {
    mode: "list" | "trash";
    /** Collections opened as a small form, like tags, categories and series. */
    isRecord: boolean;
    /** Collections that can be archived (documents). */
    isContent: boolean;
    folders: readonly Folder[];
    collection: string;
    /** Taxonomy field name -> options. Makes an "Add ○○" submenu for each many-relation taxonomy field (tags etc.). */
    options: TaxonomyOptions;
}
/** Action a menu item calls. The target is always the rows chosen by `actionTargets`. */
export interface RowMenuHandlers {
    openEditor: (item: ListEntriesItem) => void;
    openInNewTab: (item: ListEntriesItem) => void;
    openRecord: (item: ListEntriesItem) => void;
    duplicate: (item: ListEntriesItem) => void;
    restore: (targets: BulkSelection[]) => void;
    confirmTrash: (targets: BulkSelection[]) => void;
    /** Archiving takes down a public post, so it asks first (for one or many). */
    confirmArchive: (targets: BulkSelection[]) => void;
    confirmPermanentDelete: (targets: BulkSelection[]) => void;
    bulk: (op: BulkOp, label: string, targets: BulkSelection[], params?: BulkParams) => void;
}
/** Row menu. One row gets open and duplicate; several rows get the item count at the top. Trash has only restore and permanent delete. */
export declare function rowMenuActions(site: Site, group: readonly ListEntriesItem[], context: RowMenuContext, handlers: RowMenuHandlers): MenuAction[];
