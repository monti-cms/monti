import type { Issue } from "../types.js";
import type { ImportPlan } from "./plan.js";
import type { ImportHost, ImportReason } from "./types.js";
/** What happened in one step of one entry's import. */
export interface ImportStep {
    readonly status: "done" | "skipped" | "failed";
    readonly reason?: ImportReason;
}
export interface ImportEntryResult {
    /** The entry's name in the archive. */
    readonly key: string;
    /** The archive collection and the collection it went to. */
    readonly collection: string;
    readonly target: string | null;
    readonly locale: string;
    readonly title: string | null;
    readonly slug: string | null;
    /** The new entry's id, once its draft exists. */
    readonly id: string | null;
    /**
     * `imported`: every step that was asked for is done. `draft`: the draft exists but a later step failed (the draft stays, and the step says why).
     * `skipped`: nothing was written. `failed`: the draft could not be made.
     */
    readonly outcome: "imported" | "draft" | "skipped" | "failed";
    readonly create: ImportStep;
    /** Saving the title, slug and body. `null` when the draft was not made. */
    readonly body: ImportStep | null;
    /** Publishing. `null` when it was not asked for, or the entry was not published in the archive. */
    readonly publish: ImportStep | null;
    /** What the writes found worth telling (a link that does not resolve, an image file that is missing). They never block. */
    readonly warnings: readonly Issue[];
    readonly notes: readonly ImportReason[];
}
/**
 * Writes the entries a plan accepted, in three steps so that the links between them resolve:
 * 1. every draft is made (the sources first, then each translation of its source), which reserves the slugs;
 * 2. every body is saved, with its title and slug (a link written as a path finds its entry, and a link by id is changed to the new id);
 * 3. with `publish`, the entries that were published in the archive are published.
 * Nothing is all-or-nothing: each entry records each step as done, skipped or failed, and a failure of a later step leaves the draft.
 */
export declare function runImport(host: ImportHost, plan: ImportPlan, options: {
    publish: boolean;
}): Promise<ImportEntryResult[]>;
