import { type ComponentType, type ReactNode } from "react";
import type { CmsNode } from "../../doc/types.js";
import type { Site } from "../../site/index.js";
import type { Analysis } from "./analyze.js";
import { type CodeTags, type HighlightedCode } from "./code.js";
import type { LooseDocumentComponents, RenderContext, RenderDocumentOptions, StoredNode } from "./types.js";
type AnyComponent = ComponentType<any>;
/** A merged component table with every core component present. */
export type ResolvedComponents = Required<Omit<LooseDocumentComponents, "marks" | "blocks" | "codeTags">> & {
    readonly marks: Readonly<Record<string, AnyComponent>>;
    readonly blocks: Readonly<Record<string, AnyComponent>>;
    readonly codeTags: CodeTags;
};
export interface RenderInput {
    readonly analysis: Analysis;
    readonly highlighted: ReadonlyMap<CmsNode, HighlightedCode>;
    readonly math: ReadonlyMap<CmsNode, string>;
    readonly components: ResolvedComponents;
    readonly ctx: RenderContext;
    readonly options: RenderDocumentOptions;
    /** The site the document is rendered for: its blocks, code settings and plugins. */
    readonly site: Site;
}
/** Forgets which block names were already warned about (for tests). */
export declare const resetMissingComponentWarnings: () => void;
export declare const renderDocumentTree: (nodes: readonly CmsNode[], input: RenderInput) => {
    content: ReactNode;
    unknown: StoredNode[];
};
export {};
