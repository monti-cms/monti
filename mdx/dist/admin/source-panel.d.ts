import { type BrowserFormat, type SourcePanelProps } from "@monti-cms/admin";
import { type Site } from "@monti-cms/core/client";
import { type StoredDocument } from "@monti-cms/core/document";
/** Id of the element a screen puts the findings about the text in. The panel's input refers to it as its description. */
export declare const SOURCE_ERROR_ID = "cms-source-error";
/** The 1-based line of the text where a top-level block of `doc` starts, or `null` when no block has this id (the text is that of `doc`). */
export declare function lineOfBlock(doc: StoredDocument, blockId: string, format: BrowserFormat): number | null;
/**
 * The MDX source panel: edits the body as MDX text and hands the document back (`SourcePanelProps`). It parses in the browser, so a mistake is found as it is
 * typed. A text that does not read becomes a document holding it as it is (one `unparsed` node), so a draft keeps it and no keystroke is lost.
 */
export declare function MdxSourcePanel({ doc, onChange, focusBlock, readOnly, onComposing }: SourcePanelProps): import("react").JSX.Element;
/** The label of the source toggle, in the admin language of `site`. */
export declare const mdxSourceLabel: (site: Site) => string;
