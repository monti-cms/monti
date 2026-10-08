import type { DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import { Tooltip } from "./render.client.js";
export { Tooltip };
/**
 * Public components for the tooltip in the JSON renderer (`renderDocument`): the mark `tooltip`, and the code tag `Tooltip` that draws a tooltip inside a
 * code block (a text effect). Both show the same component.
 */
export declare const documentComponents: (_context: DocumentComponentsContext) => LooseDocumentComponents;
