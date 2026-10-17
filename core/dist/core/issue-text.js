import { issueMessages } from "./issues.messages.js";
export { issueMessages };
/** Codes whose `message` names the target (a property name, an address, a parser error). It follows the code's text. */
const DETAILED_CODES = new Set([
    "untranslated_text",
    "mdx_error",
    "missing_block_attribute",
    "invalid_block_attribute",
    "unknown_block_attribute",
    "disallowed_block",
    "disallowed_mark",
    "code_annotation_out_of_range",
    "footnote_definition_missing",
    "footnote_definition_unused",
    "footnote_definition_duplicate",
    "unknown_select_value",
    "code_ref_broken",
    "code_anchor_duplicate",
    "unresolved_internal_link",
    "unpublished_internal_link",
    "image_src_not_allowed",
]);
/**
 * The codes of a request value that did not check (zod's issue codes), and the text each is shown with. Their `message` is the library's own words, so it is
 * never shown: a missing or wrong-typed value reads as a required one, a too long one as too long, and the rest as not valid.
 */
const REQUEST_VALUE_CODES = {
    invalid_type: "missing_field",
    too_small: "missing_field",
    too_big: "field_too_long",
    invalid_format: "invalid_value",
    invalid_value: "invalid_value",
    invalid_union: "invalid_value",
    invalid_key: "invalid_value",
    invalid_element: "invalid_value",
    not_multiple_of: "invalid_value",
    unrecognized_keys: "invalid_value",
    custom: "invalid_value",
};
const hasKey = (key) => key in issueMessages.messages.en;
/** The field path of an issue as text: a zod issue's path is a list of keys. */
const pathText = (path) => {
    if (path === undefined)
        return undefined;
    const text = typeof path === "string" ? path : path.map(String).join(".");
    return text || undefined;
};
/**
 * The text of an issue in the admin language. A code in the `cms.core.issues` dictionary has its text there (a required or too long field names the field
 * from `message`, its label); a code whose `message` names the target adds it. A code the dictionary does not have is shown as its own `message`, which a
 * hook writes for a person.
 */
export function issueText(site, issue) {
    const t = site.createTranslator(issueMessages);
    const { code, message } = issue;
    const text = (() => {
        if (code === undefined)
            return message || t("unknown");
        const requestValue = REQUEST_VALUE_CODES[code];
        if (requestValue)
            return t(requestValue);
        if (message && code === "missing_field")
            return t("field.missing", { label: message });
        if (message && code === "field_too_long")
            return t("field.tooLong", { label: message });
        if (!hasKey(code))
            return message || t("unknown");
        return message && DETAILED_CODES.has(code) ? `${t(code)} — ${message}` : t(code);
    })();
    const { line, column } = issue.position ?? {};
    const where = line !== undefined && column !== undefined ? t("position", { line, column }) : pathText(issue.path);
    return where ? { text, where } : { text };
}
/** The issues with their text, as an admin answer sends them. */
export const tellIssues = (site, issues) => issues.map((issue) => ({ ...issue, ...issueText(site, issue) }));
