/**
 * Collection field builders. Like Keystatic's `fields.*`, fields are defined in one place in code.
 *
 * Field definitions are used by both the server and the browser, so they hold **only JSON-serializable values**.
 * No functions, React components or secret values. An input override (`input`) points only by name, and the actual implementation lives in the client
 * input registry. The AI button next to an input is not part of the field definition; the screen slot (`src/cms/slots`) attaches it by field name.
 */
export const SUMMARY_ROLE = "summary";
/**
 * The role of the title field. A collection has exactly one title field: the field with this role, or, when no field has it, the text field named {@link DEFAULT_TITLE_FIELD}.
 * Read it with `titleFieldOf`, never by the key.
 */
export const TITLE_ROLE = "title";
/** The name of the title field of a collection that does not give the title role to any field. */
export const DEFAULT_TITLE_FIELD = "title";
/**
 * Keys the core uses separately in metadata. They cannot be used as field names (`defineSite` blocks them).
 * `translations` holds the per-language values of an item collection.
 */
export const RESERVED_METADATA_KEYS = ["translations"];
/** Whether the field must not be empty (`required: true`). */
export const isRequiredField = (field) => field.required === true;
/** Default character count when filling from the body. */
export const FILL_FROM_BODY_MAX_LENGTH = 160;
/**
 * Character count of a field filled from the body (`fillFromBody`). No longer than the field's `max`. `undefined` for a field that is not filled.
 */
export function fillFromBodyLength(field) {
    const fill = field.fillFromBody;
    if (!fill)
        return undefined;
    const length = fill === true ? FILL_FROM_BODY_MAX_LENGTH : (fill.maxLength ?? FILL_FROM_BODY_MAX_LENGTH);
    return field.max === undefined ? length : Math.min(length, field.max);
}
export const fields = {
    text: (options) => ({ kind: "text", ...options }),
    slug: (options) => ({ kind: "slug", ...options }),
    relation: (options) => ({ kind: "relation", ...options }),
    backlink: (options) => ({ kind: "backlink", ...options }),
    view: (options) => ({ kind: "view", ...options }),
    select: (options) => ({ kind: "select", ...options }),
    media: (options) => ({ kind: "media", ...options }),
    conditional: (discriminant, values) => ({
        kind: "conditional",
        label: discriminant.label,
        ...(discriminant.description ? { description: discriminant.description } : {}),
        discriminant,
        values,
    }),
};
export const storageTypeOf = (field) => field.kind === "relation" && field.many ? "string[]" : "string";
