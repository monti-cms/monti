import type { ComponentType, ReactNode } from "react";
import { type TocItem } from "remark-flexible-toc";
import type { PluggableList } from "unified";
import type { ImageResolver } from "../mdx/image-src.js";
import { type CodeHighlightOptions } from "./code/index.js";
export type MdxComponents = Record<string, ComponentType<any>>;
/** Fixed texts of the core default components. Passed in the site language. */
export interface RenderLabels {
    readonly imageUnavailable: string;
    readonly fileUnavailable: string;
    readonly download: string;
    readonly showFoldedCode: string;
    readonly copyCode: string;
    readonly copied: string;
    readonly codeNotes: string;
}
export interface RenderMdxOptions {
    /** Resolver for body image and file addresses (`createPublicImageResolver(mdx)`). Only the outer `src` if absent. */
    readonly imageResolver?: ImageResolver;
    /** Language of the public page. Block public components receive it. */
    readonly locale?: string;
    /** Rewrites in-site links in the body (e.g. to the same-language translation address). */
    readonly resolveHref?: (href: string) => string;
    /** Components to override (name → component). The block name is the block definition's `component`. */
    readonly components?: MdxComponents;
    readonly labels?: Partial<RenderLabels>;
    /** Code highlighting (languages and themes). */
    readonly code?: CodeHighlightOptions;
    /** remark and rehype plugins to add after the core plugins. */
    readonly remarkPlugins?: PluggableList;
    readonly rehypePlugins?: PluggableList;
}
/** Public components given by block extensions (plugin `render`). They receive the site language and the resolver. */
export interface PluginRenderContext {
    readonly locale?: string;
    readonly imageResolver?: ImageResolver;
}
/** Core remark order. The editor and the review runner use the same setup. */
export declare const mdxRemarkPlugins: (tocRef?: TocItem[]) => PluggableList;
/** Core rehype order. */
export declare const mdxRehypePlugins: (code?: CodeHighlightOptions) => PluggableList;
/** Core default components. */
export declare function defaultMdxComponents(options?: RenderMdxOptions): MdxComponents;
/** Component table merged in the order core defaults → block extensions → site. */
export declare function mdxComponents(options?: RenderMdxOptions): Promise<MdxComponents>;
export interface RenderedMdx {
    readonly content: ReactNode;
    /** Heading table of contents (depth 1 from h2). */
    readonly toc: readonly TocItem[];
}
/**
 * Renders published MDX. Bodies that fail the check (`analyze`) are not put into the executing compiler and an error is thrown (a body that
 * has passed the publish boundary is blocked again).
 */
export declare function renderMdx(source: string, options?: RenderMdxOptions): Promise<RenderedMdx>;
export type { TocItem } from "remark-flexible-toc";
/** Resolver that resolves registered media into public addresses for public MDX (server only). */
export { createPublicImageResolver } from "../mdx/public-image-resolver.js";
