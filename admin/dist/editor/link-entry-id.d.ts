import { Extension } from "@tiptap/core";
/**
 * An internal link carries the id of the entry it points to (`entryId`) next to the `href` the editor shows. The document stores the id only: the `href`
 * is dropped when the editor's content is saved (`tiptapToStored`), so the link follows the entry when its slug changes.
 */
export declare const CmsLinkEntryId: Extension<any, any>;
