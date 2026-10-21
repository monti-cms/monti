import type { RestoreResult } from "../../../../core/store/types.js";
import type { RestorePreview, RestoreProblem } from "../../../../services/restore/types.js";
import type { Site } from "../../../../site/index.js";
/** A problem as the answer sends it: what it is about, its code, and the text in the admin language (with what the failed check found, when it found something). */
export interface ToldProblem {
    readonly subject: RestoreProblem["subject"];
    readonly id: string | null;
    readonly label: string | null;
    readonly code: string;
    readonly text: string;
    /** What a failed check of the content found wrong, one line each. */
    readonly found: string[];
}
export declare function tellProblem(site: Site, problem: RestoreProblem): ToldProblem;
/** What a restore would do, for the preview: the counts, the problems that stop it, the warnings, and what a restore does not bring back. */
export declare function presentPreview(site: Site, preview: RestorePreview): {
    mode: "preview";
    ready: boolean;
    isBackup: boolean;
    /** The text that says why the archive is not a backup. */
    refusal: {
        text: string;
        fix?: string | undefined;
    } | null;
    empty: boolean;
    counts: {
        entries: number;
        byStatus: Record<string, number>;
        translations: number;
        folders: number;
        media: number;
        addresses: number;
        aliases: number;
        templatesAdded: number;
        templatesSkipped: {
            id: string;
            name: string;
            reason: "id" | "name";
            text: string;
        }[];
    };
    problems: ToldProblem[];
    warnings: {
        code: import("../../../../services/restore/types.js").RestoreWarningCode;
        id: string | null;
        label: string | null;
        text: string;
    }[];
    notRestored: {
        code: import("../../../../services/restore/types.js").NotRestoredCode;
        count: number | null;
        text: string;
    }[];
};
/** What a restore wrote, with the warnings and the data it left out. */
export declare function presentRun(site: Site, preview: RestorePreview, result: RestoreResult): {
    mode: "run";
    counts: {
        entries: number;
        byStatus: Record<string, number>;
        translations: number;
        folders: number;
        media: number;
        addresses: number;
        aliases: number;
        templatesAdded: number;
        templatesSkipped: {
            id: string;
            name: string;
            reason: "id" | "name";
            text: string;
        }[];
    };
    warnings: {
        code: import("../../../../services/restore/types.js").RestoreWarningCode;
        id: string | null;
        label: string | null;
        text: string;
    }[];
    notRestored: {
        code: import("../../../../services/restore/types.js").NotRestoredCode;
        count: number | null;
        text: string;
    }[];
};
