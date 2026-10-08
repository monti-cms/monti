/** One line of a line diff: in both texts (`same`), only in the first (`remove`) or only in the second (`add`). */
export interface DiffLine {
    readonly type: "same" | "remove" | "add";
    readonly text: string;
}
/**
 * A line diff of two texts (the longest common subsequence of their lines). `remove` lines are in `before` only, `add` lines in `after` only. For the conflict
 * screen: `before` is the server's text and `after` is git's.
 */
export declare function lineDiff(before: string, after: string): DiffLine[];
