import { type StoredDocument } from "@monti-cms/core/document";
/**
 * Template menu at the end of the editor toolbar. Fetches the list on first open.
 * If the body is empty, inserts the chosen template right away; if there is body text, asks first whether to replace it.
 * A template is a document; applying one hands the entry a copy of it with new block ids (ids are unique within a body, and the translation and
 * diff views pair blocks by them, so the template's own ids must not end up in many entries).
 */
export declare function TemplateMenu({ currentDoc, disabled, onApply, }: {
    currentDoc: StoredDocument;
    disabled: boolean;
    onApply: (doc: StoredDocument) => void;
}): import("react").JSX.Element;
