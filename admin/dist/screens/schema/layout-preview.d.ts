import type { Obj } from "./schema-model.js";
/**
 * The properties panel of the edit screen for the schema being edited, running for real: the same components on a site made from the draft, so tabs, groups,
 * required marks, options, help texts and conditional fields are what the editor will show. It is interactive and keeps nothing: writes are refused and nothing
 * is saved. It follows the tree and the sheets as the draft changes.
 */
export declare function LayoutPreview({ file, collection, codeCollections, onClose, }: {
    /** The schema file as edited. */
    file: Obj;
    /** The collection shown. */
    collection: string;
    codeCollections: readonly string[];
    onClose: () => void;
}): import("react").JSX.Element;
