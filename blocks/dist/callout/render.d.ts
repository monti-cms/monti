import type { DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import { type PropsWithChildren } from "react";
import { type BlockLabels } from "../shared/labels.js";
/** Callout. Wraps the title and body in a box with an accent color per `variant`. An unknown variant falls back to note; a missing title falls back to the variant name. */
export declare function Callout({ variant, title, labels, children, }: PropsWithChildren<{
    variant?: string;
    title?: string;
    labels?: BlockLabels;
}>): import("react").JSX.Element;
/** Public components for the callout in the JSON renderer (`renderDocument`): the block `callout`, with its attributes as props. */
export declare const documentComponents: ({ locale }: DocumentComponentsContext) => LooseDocumentComponents;
