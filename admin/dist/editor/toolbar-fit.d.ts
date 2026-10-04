/** Size info for one item placed on the toolbar. `divider` is the separator between groups. */
export interface FitItem {
    key: string;
    /** Larger values are hidden first. */
    priority: number;
    /** If true, never hidden even when narrow. */
    fixed?: boolean;
    width: number;
    divider?: boolean;
}
/**
 * Decides which items to actually draw from the visible tool keys.
 * A divider is drawn only when there are visible tools on both sides, and only one is drawn when several come in a row.
 */
export declare function layoutKeys(items: FitItem[], visible: ReadonlySet<string>): string[];
/**
 * Hides tools starting from the lowest priority (largest number) until the rest fit the available width, and returns the keys of the remaining tools.
 * If any tool is hidden, the "More" button (`overflowWidth`) also takes one slot. `gap` is the spacing between items.
 * On equal priority, later tools are hidden first. If it still overflows with only pinned tools left, it is left as is.
 */
export declare function fitSlots(items: FitItem[], available: number, overflowWidth: number, gap?: number): Set<string>;
