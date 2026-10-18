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
/**
 * The translation group after a write. The write responses carry the group as the server has it (a first save has just made this entry its only member), which wins;
 * a response without one keeps what was received on load. Either way this entry's status is the one just written.
 */
export function keepTranslationGroup(current, next) {
    const translations = (next.translations ?? current?.translations)?.map((member) => member.id === next.id ? { ...member, status: next.status } : member);
    return { translations, source: current?.source ?? next.source };
}
