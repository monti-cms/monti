import type { BulkOp, Site } from "@monti-cms/core/client";
import type { Folder } from "@monti-cms/core/runtime";
import { type CmsIssue } from "../api-error-message.js";
export type BulkUsage = {
    entryId: string;
    title: string | null;
    collection: string;
    state: string;
};
export type BulkItemResult = {
    id: string;
    ok: true;
    version: number;
} | {
    id: string;
    ok: false;
    error: string;
    issues?: CmsIssue[];
    usages?: BulkUsage[];
};
export type BulkSelection = {
    id: string;
    expectedVersion: number;
    title?: string | null;
};
type RunBulkArgs = Parameters<typeof runBulk> extends [unknown, ...infer Rest] ? Rest : never;
type RelationOp = Extract<BulkOp, `relation.${string}`>;
/**
 * Actions on screen. A category action pairs a relation-field bulk action with a field name, like `relation.add:tagIds`.
 * It is sent to the server as a relation-field bulk action (`relation.*`).
 */
type ListAction = Exclude<BulkOp, RelationOp> | `${RelationOp}:${string}`;
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
export declare function runBulk(site: Site, op: BulkOp, items: BulkSelection[], params?: {
    field?: string;
    ids?: string[];
    id?: string | null;
    folderId?: string | null;
}): Promise<BulkItemResult[]>;
/**
 * Bulk actions. Apply only to items picked on the current page and show a result per item.
 * Only failed items can be rerun. The trash screen (`mode="trash"`) offers only bulk permanent delete.
 */
export declare function BulkBar({ collection, selected, folders, mode, onClearSelection, onRun, onDone, }: {
    collection: string;
    selected: BulkSelection[];
    folders: Folder[];
    mode?: "list" | "trash";
    onClearSelection: () => void;
    /** Action request. The list screen passes a request that updates the list first (optimistic update). */
    onRun?: (...args: RunBulkArgs) => ReturnType<typeof runBulk>;
    onDone?: (failedIds: string[]) => void;
}): import("react").JSX.Element | null;
export {};
