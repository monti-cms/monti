/** Word-level changes (style polish preview). `same` is unchanged, `del` is removed text, and `add` is added text. */
export type DiffPart = {
    readonly type: "same" | "del" | "add";
    readonly text: string;
};
/** Finds the changes between two texts using the longest common subsequence. Adjacent runs of the same kind are merged. */
export declare function diffWords(before: string, after: string): DiffPart[];
