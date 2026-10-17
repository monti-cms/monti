import type { Site } from "@monti-cms/core/site";
import { type EditorError, type EditorResult } from "../../hooks/result.js";
import type { EntryData } from "./entry-form.js";
export declare const wait: (ms: number) => Promise<void>;
export type Failure = EditorResult<never>;
/** An `EditorError` for something thrown by the client: the server's message, the network text, or `fallback`. */
export declare function failureOf(site: Site, error: unknown, fallback: string): EditorError;
export declare const failed: (error: EditorError) => Failure;
/** Save and publish responses carry no translation group info. Keep what was received on load and update only this entry's status. */
export declare function keepTranslationGroup(current: EntryData | null, next: EntryData): Pick<EntryData, "translations" | "source">;
