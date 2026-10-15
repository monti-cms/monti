import { type Tree } from "./layout-model.js";
export interface LayoutOps {
    /** Applies a change to the tree of the collection as it is when the change runs. */
    readonly change: (next: (tree: Tree) => Tree) => void;
    readonly tree: Tree;
    readonly showTabs: boolean;
    readonly disabled: boolean;
}
/** A tab of the panel as a row of the tree: shown for all tabs including the default tab. */
export declare function TabRow({ ops, index }: {
    ops: LayoutOps;
    index: number;
}): import("react").JSX.Element | null;
/** A group of the panel as a row of the tree: its title is edited in place, its fields sit under it. */
export declare function GroupRow({ ops, tab, block }: {
    ops: LayoutOps;
    tab: number;
    block: number;
}): import("react").JSX.Element | null;
/** The place to drop a field into a group that has none, or after the last block of a tab. */
export declare function DropRow({ id, label, testId }: {
    id: string;
    label?: string;
    testId: string;
}): import("react").JSX.Element;
