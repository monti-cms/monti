import { josa } from "@monti-cms/core/client";
/**
 * How admin messages name the entries of a collection. They take the collection's own label ("Post", "Memo", "게시글"), so a memo screen says "memo" and not "post".
 * The label goes into messages as the `noun` variable; each dictionary decides how it reads in its language.
 */
/** The label of a collection, or an empty text when the collection is not known (the dictionaries then use a neutral word). */
export const collectionNoun = (site, collection) => site.isCollection(collection) ? (site.COLLECTION_DEFINITIONS[collection]?.label ?? "") : "";
/** The `noun` message variable of a collection. */
export const nounVars = (site, collection) => ({
    noun: collectionNoun(site, collection),
});
const nounOf = (vars) => String(vars.noun ?? "").trim();
/**
 * English: the label inside a sentence. A label written as a capitalized word ("Post") becomes lower case ("post"); one with capitals of its own ("FAQ") is kept.
 * Without a label the neutral word "entry" is used.
 */
export const enNoun = (vars) => {
    const noun = nounOf(vars);
    if (!noun)
        return "entry";
    return /^\p{Lu}[^\p{Lu}]*$/u.test(noun) ? noun.toLowerCase() : noun;
};
/** English: "3 selected post entries". The plural of a label is not known, so the count goes with "entries"; without a label it is "3 selected items". */
export const enSelected = (vars) => {
    const count = Number(vars.count);
    if (!nounOf(vars))
        return `${count} selected ${count === 1 ? "item" : "items"}`;
    return `${count} selected ${enNoun(vars)} ${count === 1 ? "entry" : "entries"}`;
};
/** Korean: the label as written, or the neutral word "항목" without one. */
export const koNoun = (vars) => nounOf(vars) || "항목";
/** Korean: the label with the object particle ("메모를", "글을"). */
export const koObject = (vars) => josa(koNoun(vars), "을", "를");
/** Korean: "선택한 메모 3개" (the count follows the label, so no particle is needed). */
export const koSelected = (vars) => `선택한 ${koNoun(vars)} ${vars.count}개`;
