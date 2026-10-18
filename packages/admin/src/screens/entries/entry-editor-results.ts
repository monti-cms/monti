import type { Site } from "@monti-cms/core/site";
import { errorText } from "../../api/client";
import { type EditorError, type EditorResult, toEditorError } from "../../hooks/result";
import type { EntryData } from "./entry-form";

// The small pieces the entry editor's parts share to wait and to report a failure.

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type Failure = EditorResult<never>;

/** An `EditorError` for something thrown by the client: the server's message, the network text, or `fallback`. */
export function failureOf(site: Site, error: unknown, fallback: string): EditorError {
	const base = toEditorError(error, fallback);
	return { ...base, message: errorText(site, error, fallback) };
}

export const failed = (error: EditorError): Failure => ({ ok: false, error });

/**
 * The translation group after a write. The write responses carry the group as the server has it (a first save has just made this entry its only member), which wins;
 * a response without one keeps what was received on load. Either way this entry's status is the one just written.
 */
export function keepTranslationGroup(
	current: EntryData | null,
	next: EntryData,
): Pick<EntryData, "translations" | "source"> {
	const translations = (next.translations ?? current?.translations)?.map((member) =>
		member.id === next.id ? { ...member, status: next.status } : member,
	);
	return { translations, source: current?.source ?? next.source };
}
