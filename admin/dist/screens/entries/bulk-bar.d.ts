import type { BulkOp, Folder, Site } from "@monti-cms/core/site";
import { type BulkItemResult, type BulkParams, type BulkSelection } from "../../api/entries.js";
type RunBulkArgs = [op: BulkOp, items: BulkSelection[], params?: BulkParams];
type RelationOp = Extract<BulkOp, `relation.${string}`>;
/**
 * Actions on screen. A category action pairs a relation-field bulk action with a field name, like `relation.add:tagIds`.
 * It is sent to the server as a relation-field bulk action (`relation.*`).
 */
type ListAction = Exclude<BulkOp, RelationOp> | `${RelationOp}:${string}` | "export";
type ActionDef = {
    value: ListAction;
    label: string;
    /**
     * Question for the confirm dialog. Actions that change many items at once always ask.
     * `count` is the number picked, `target` is the name of the picked target (folder, category). `null` for an action that clears the target.
     */
    ask: (count: number, target: string | null) => string;
    content?: boolean;
    destructive?: boolean;
    /** The relation field, for a category action. */
    relation?: {
        op: RelationOp;
        field: string;
        label: string;
        many: boolean;
    };
};
/**
 * Actions per category field (tags, categories, etc.) of the collection. Fields that hold many get add/remove; a field that holds only one gets replace.
 * Multi-value field actions come first.
 */
export declare function taxonomyActions(site: Site, collection: string): ActionDef[];
/** Reason for a single failure. If a usage blocked permanent deletion, names it as `In use: <name>`. */
export declare function describeBulkFailure(site: Site, failure: Extract<BulkItemResult, {
    ok: false;
}>): string;
/**
 * Bulk actions. Apply only to items picked on the current page and show a result per item.
 * Only failed items can be rerun. The trash screen (`mode="trash"`) offers only bulk permanent delete.
 */
export declare function BulkBar({ collection, selected, folders, mode, onClearSelection, onRun, onDone, }: {
    collection: string;
    selected: BulkSelection[];
    /** The folders items can move to; `null` where the list shows no folders, which leaves out the folder move. */
    folders: readonly Folder[] | null;
    mode?: "list" | "trash";
    onClearSelection: () => void;
    /** Action request. The list screen passes a request that updates the list first (optimistic update). */
    onRun?: (...args: RunBulkArgs) => Promise<BulkItemResult[]>;
    onDone?: (failedIds: string[]) => void;
}): import("react").JSX.Element | null;
export {};
