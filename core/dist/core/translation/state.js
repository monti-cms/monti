import { readStoredDocument } from "../../doc/stored-document.js";
/** Upper limit on translation state size (the whole JSON). Same as the limit on a stored document (8MiB). */
export const MAX_TRANSLATION_BYTES = 8 * 1024 * 1024;
const byteLength = (state) => new TextEncoder().encode(JSON.stringify(state)).length;
/** The state that confirms a source: its document. */
export function confirmedSourceState(doc) {
    return { version: 4, baseDoc: doc };
}
/** Validates an incoming value as a translation state. A wrong shape is treated as an error (returns `undefined`). */
export function parseTranslationState(value) {
    if (value === null)
        return null;
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const record = value;
    if (record.version !== 4 || Object.keys(record).length !== 2)
        return undefined;
    const baseDoc = readStoredDocument(record.baseDoc);
    if (!baseDoc)
        return undefined;
    const state = { version: 4, baseDoc };
    return byteLength(state) > MAX_TRANSLATION_BYTES ? undefined : state;
}
