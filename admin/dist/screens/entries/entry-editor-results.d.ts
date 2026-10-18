import type { Site } from "@monti-cms/core/site";
import { type EditorError, type EditorResult } from "../../hooks/result.js";
import type { EntryData } from "./entry-form.js";
export declare const wait: (ms: number) => Promise<void>;
export type Failure = EditorResult<never>;
/** An `EditorError` for something thrown by the client: the server's message, the network text, or `fallback`. */
export declare function failureOf(site: Site, error: unknown, fallback: string): EditorError;
export declare const failed: (error: EditorError) => Failure;
/**
 * The translation group after a write. The write responses carry the group as the server has it (a first save has just made this entry its only member), which wins;
 * a response without one keeps what was received on load. Either way this entry's status is the one just written.
 */
export declare function keepTranslationGroup(current: EntryData | null, next: EntryData): Pick<EntryData, "translations" | "source">;
