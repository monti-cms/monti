import type { Issue } from "../../../../core/types.js";
import type { ImportPlan } from "../../../../services/entry-import/plan.js";
import type { ImportEntryResult } from "../../../../services/entry-import/run.js";
import type { ImportReason } from "../../../../services/entry-import/types.js";
import type { Site } from "../../../../site/index.js";
/** A reason as the answer sends it: its code, and the text in the admin language (with what to do about it, when a write said so). */
export interface ToldReason {
    readonly code: string;
    readonly text: string;
    readonly fix?: string;
}
export declare const tellReason: (site: Site, reason: ImportReason) => ToldReason;
/**
 * What an import would do, for the preview: the archive's collections and where each goes, every entry with its target and what happens to it, the values that
 * are not read, and the counts that sum it up. It carries everything the person needs to decide, and nothing is written.
 */
export declare function presentPlan(site: Site, plan: ImportPlan): {
    mode: "preview";
    kind: import("../../../../services/entry-import/types.js").ImportKind;
    collections: {
        name: string;
        entries: number;
        target: string | null;
        skipped: ToldReason | null;
    }[];
    targets: readonly {
        name: string;
        label: string;
    }[];
    entries: {
        key: string;
        collection: string;
        target: string | null;
        title: string | null;
        slug: string | null;
        locale: string;
        isTranslation: boolean;
        body: {
            kind: string;
            format: string;
        } | {
            format?: undefined;
            kind: string;
        } | null;
        published: boolean;
        outsideImages: number;
        keptLinks: number;
        skipped: ToldReason | null;
        notes: ToldReason[];
    }[];
    fieldsNotImported: readonly import("../../../../services/entry-import/plan.js").FieldsNotImported[];
    counts: {
        entries: number;
        imported: number;
        skipped: number;
        conflicts: number;
        publishable: number;
        outsideImages: number;
        keptLinks: number;
        otherFiles: number;
    };
};
/** The per-entry results of a run, with the text of each reason and warning in the admin language. */
export declare function presentResults(site: Site, results: readonly ImportEntryResult[]): {
    mode: "run";
    results: {
        key: string;
        collection: string;
        target: string | null;
        locale: string;
        title: string | null;
        slug: string | null;
        id: string | null;
        outcome: "draft" | "failed" | "imported" | "skipped";
        create: {
            status: "done" | "failed" | "skipped";
            reason?: ToldReason | undefined;
        } | null;
        body: {
            status: "done" | "failed" | "skipped";
            reason?: ToldReason | undefined;
        } | null;
        publish: {
            status: "done" | "failed" | "skipped";
            reason?: ToldReason | undefined;
        } | null;
        warnings: import("../../../../site-entry.js").ToldIssue<Issue>[];
        notes: ToldReason[];
    }[];
    counts: {
        imported: number;
        draft: number;
        skipped: number;
        failed: number;
        published: number;
    };
};
