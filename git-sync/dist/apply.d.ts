import { type Entry } from "@monti-cms/core/plugin/server";
import { type ParsedEntryFile } from "./entry-file.js";
import type { ResolvedTarget } from "./options.js";
import type { SyncRecord } from "./state.js";
import { type SyncContext } from "./sync.js";
/** Writing what a file says into the CMS: the pieces the import (`inbound.ts`) and the conflict resolution (`conflicts.ts`) share. */
/** A readable description of why a write failed: the error code and what the pipeline found, not a stack trace. */
export declare function describeError(error: unknown): string;
/** The entry as it is now, or `null` when it does not exist. */
export declare function readEntry(ctx: SyncContext, entryId: string): Promise<Entry | null>;
/** What a file says, with the place it was found. */
export interface FileToApply {
    readonly path: string;
    readonly sha: string;
    readonly file: ParsedEntryFile;
    readonly collection: string;
    readonly locale: string;
    readonly slug: string;
}
export interface Applied {
    readonly entry: Entry & {
        published: NonNullable<Entry["published"]>;
    };
    readonly created: boolean;
}
/**
 * Writes a file to the CMS and publishes it: an existing entry takes the file's fields and body as its draft and publishes it; with no entry, one is created
 * (a translation from its source). Blocked states are cleared first (a trashed entry is restored, an archived one unarchived). Every step is the content
 * service's, so hooks, validation and the references of the body run as for any edit. The files being written are marked, so the publishes this causes are
 * not pushed back.
 */
export declare function applyFile(ctx: SyncContext, target: ResolvedTarget, input: FileToApply & {
    readonly entry: Entry | null;
    /** The entry an id in `translationOf` stands for, when it was created in this pull. */
    readonly resolveSource?: (id: string) => string | undefined;
}): Promise<Applied>;
/** The record of an entry synced from a file. */
export declare const recordOf: (target: ResolvedTarget, file: Pick<FileToApply, "path" | "sha">, applied: Applied, now: number) => SyncRecord;
