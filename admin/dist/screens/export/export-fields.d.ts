import type { ExportForm, ExportPhase } from "./use-export-form.js";
/**
 * The choices and counts of an export, one component for the card and both dialogs: the counts first (they follow the scope), then the scope, then the files.
 * JSON is always in; each text format the server lists is a checkbox. `noun` is the label of the collection the selected entries belong to.
 */
export declare function ExportFields({ form, selection, noun, }: {
    form: ExportForm;
    selection?: boolean;
    noun?: string;
}): import("react").JSX.Element;
/** What the export is doing while it runs: building the archive, then the share of it that has come down. */
export declare function ExportProgressLine({ phase }: {
    phase: ExportPhase | null;
}): import("react").JSX.Element | null;
/** The export button of a form: disabled while it runs, and when a selection holds nothing to export. */
export declare function ExportButton({ form, label, selection, onDone, }: {
    form: ExportForm;
    label: string;
    selection?: boolean;
    onDone?: () => void;
}): import("react").JSX.Element;
