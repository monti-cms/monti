import { errorText } from "../../api/client.js";
import { toEditorError } from "../../hooks/result.js";
// The small pieces the entry editor's parts share to wait and to report a failure.
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** An `EditorError` for something thrown by the client: the server's message, the network text, or `fallback`. */
export function failureOf(site, error, fallback) {
    const base = toEditorError(error, fallback);
    return { ...base, message: errorText(site, error, fallback) };
}
export const failed = (error) => ({ ok: false, error });
/** Save and publish responses carry no translation group info. Keep what was received on load and update only this entry's status. */
export function keepTranslationGroup(current, next) {
    const translations = (current?.translations ?? next.translations)?.map((member) => member.id === next.id ? { ...member, status: next.status } : member);
    return { translations, source: current?.source ?? next.source };
}
