import type { Site } from "@monti-cms/core/client";
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

/** Save and publish responses carry no translation group info. Keep what was received on load and update only this entry's status. */
export function keepTranslationGroup(
	current: EntryData | null,
	next: EntryData,
): Pick<EntryData, "translations" | "source"> {
	const translations = (current?.translations ?? next.translations)?.map((member) =>
		member.id === next.id ? { ...member, status: next.status } : member,
	);
	return { translations, source: current?.source ?? next.source };
}
