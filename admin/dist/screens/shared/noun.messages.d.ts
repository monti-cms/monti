import { type MessageVars, type Site } from "@monti-cms/core/client";
/**
 * How admin messages name the entries of a collection. They take the collection's own label ("Post", "Memo", "게시글"), so a memo screen says "memo" and not "post".
 * The label goes into messages as the `noun` variable; each dictionary decides how it reads in its language.
 */
/** The label of a collection, or an empty text when the collection is not known (the dictionaries then use a neutral word). */
export declare const collectionNoun: (site: Site, collection: string) => string;
/** The `noun` message variable of a collection. */
export declare const nounVars: (site: Site, collection: string) => {
    noun: string;
};
/**
 * English: the label inside a sentence. A label written as a capitalized word ("Post") becomes lower case ("post"); one with capitals of its own ("FAQ") is kept.
 * Without a label the neutral word "entry" is used.
 */
export declare const enNoun: (vars: MessageVars) => string;
/** English: "3 selected post entries". The plural of a label is not known, so the count goes with "entries"; without a label it is "3 selected items". */
export declare const enSelected: (vars: MessageVars) => string;
/** Korean: the label as written, or the neutral word "항목" without one. */
export declare const koNoun: (vars: MessageVars) => string;
/** Korean: the label with the object particle ("메모를", "글을"). */
export declare const koObject: (vars: MessageVars) => string;
/** Korean: "선택한 메모 3개" (the count follows the label, so no particle is needed). */
export declare const koSelected: (vars: MessageVars) => string;
