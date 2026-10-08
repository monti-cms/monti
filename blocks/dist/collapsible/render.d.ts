import type { DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import type { PropsWithChildren } from "react";
import { type BlockLabels } from "../shared/labels.js";
/** Collapsible. Expands when the title is clicked (it is a `<details>`, so no script is needed). With no title, the default text in the site language is used. */
export declare function Collapsible({ title, defaultOpen, labels, children, }: PropsWithChildren<{
    title?: string;
    defaultOpen?: boolean;
    labels?: BlockLabels;
}>): import("react").JSX.Element;
/** Public components for the collapsible in the JSON renderer (`renderDocument`). */
export declare const documentComponents: ({ locale }: DocumentComponentsContext) => LooseDocumentComponents;
