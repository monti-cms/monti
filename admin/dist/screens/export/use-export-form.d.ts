import { type ExportFormat, type ExportScope } from "../../api/export.js";
/** How far an export is: building the archive on the server, or reading it (`percent` when the server said how large it is). */
export type ExportPhase = {
    kind: "building";
} | {
    kind: "downloading";
    percent: number | null;
};
/**
 * The state of one export, shared by the Site backup card, the dialog of selected entries and the dialog of one entry: the scope, the text format,
 * the summary of what the archive would hold, and the download. `ids` limits it to those entries (their translations come along); without it the export is the whole site.
 */
export declare function useExportForm({ ids }?: {
    ids?: readonly string[];
}): {
    scope: ExportScope;
    setScope: import("react").Dispatch<import("react").SetStateAction<ExportScope>>;
    formats: readonly ExportFormat[];
    formatsQuery: import("@tanstack/react-query").UseQueryResult<ExportFormat[], Error>;
    format: string | undefined;
    /** Picks a text format, or clears it when it is the one picked. */
    toggleFormat: (name: string) => void;
    summary: import("../../api/export.js").ExportSummary | undefined;
    summaryQuery: import("@tanstack/react-query").UseQueryResult<import("../../api/export.js").ExportSummary, Error>;
    phase: ExportPhase | null;
    isExporting: boolean;
    /** Builds the archive and saves it. Resolves when it is done; a failure is toasted. */
    run: () => Promise<boolean>;
};
export type ExportForm = ReturnType<typeof useExportForm>;
