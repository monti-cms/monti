/** Upper limit on translation state size. Same as the source body limit (2MiB). */
export const MAX_TRANSLATION_BYTES = 2 * 1024 * 1024;
/** Validates an incoming value as a translation state. A wrong shape is treated as an error (returns `undefined`). */
export function parseTranslationState(value) {
    if (value === null)
        return null;
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const record = value;
    if (Object.keys(record).length !== 2 || record.version !== 2 || typeof record.baseSource !== "string") {
        return undefined;
    }
    if (new TextEncoder().encode(record.baseSource).length > MAX_TRANSLATION_BYTES)
        return undefined;
    return { version: 2, baseSource: record.baseSource };
}
