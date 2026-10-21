import type { ImportPreview } from "../../api/import.js";
import type { ImportForm } from "./use-import-entries.js";
/** The archive as the server reads it: the counts, where each collection goes, every entry and what happens to it, and what is left behind. */
export declare function PreviewView({ preview, form }: {
    preview: ImportPreview;
    form: ImportForm;
}): import("react").JSX.Element;
