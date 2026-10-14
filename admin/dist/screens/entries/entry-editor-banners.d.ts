import type { FormatIssue } from "@monti-cms/core/format";
import { type CmsIssue } from "../../api/error-message.js";
import type { EntryEditor } from "./entry-editor-types.js";
interface EntryEditorBannersProps {
    editor: EntryEditor;
    /** The body could not be read and the source panel is the only way to fix it. */
    visualUnavailable: boolean;
    /** The first thing the source panel found wrong with the text, shown beside the unavailable notice. */
    sourceProblem?: FormatIssue;
    onFocusIssue: (issue: CmsIssue) => void;
    /** Whether to show the "source changed" bar, with its two actions. */
    sourceChanged: boolean;
    onCompareSource: () => void;
}
export declare function EntryEditorBanners({ editor, visualUnavailable, sourceProblem, onFocusIssue, sourceChanged, onCompareSource, }: EntryEditorBannersProps): import("react").JSX.Element;
export {};
