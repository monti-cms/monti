import type { DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import { type PropsWithChildren } from "react";
import { type BlockLabels } from "../shared/labels.js";
/**
 * Code explorer. Builds a file tree from the paths in the code blocks' `title` and shows the code of one file at a time (`open`, the path of the file shown first,
 * or the first file that has code). Switching is done by a client component (`CodeExplorerView`); every file's code block is rendered here and only hidden there.
 */
export declare function CodeExplorer({ open, labels, children, }: PropsWithChildren<{
    open?: string;
    labels?: BlockLabels;
}>): import("react").JSX.Element;
/** Public components for the code explorer in the JSON renderer (`renderDocument`): the block `code-explorer`, reading its files from the stored code blocks. */
export declare const documentComponents: ({ locale }: DocumentComponentsContext) => LooseDocumentComponents;
