import type { PluggableList } from "unified";
import type { BlockDefinition } from "../blocks/define";
import type { CmsMark, CmsNode } from "../mdx/types";

/**
 * Syntax extensions.
 *
 * Stored MDX follows CommonMark + GFM, then standard MDX JSX. Anything beyond that (for example `:::callout` directives) is an opt-in
 * **syntax extension** that provides both halves of a notation: how it is read (remark plugins) and how it is written (serializers).
 * One meaning has one stored notation: other notations are accepted on input and converted when the content is saved.
 *
 * @experimental The extension interface may change in a minor release.
 */

/** The body blocks the site uses, as seen by a syntax extension. */
export interface SyntaxBlocks {
	/** Every block the site uses (core blocks, blocks added by plugins, and the site config's `blocks`). */
	readonly list: readonly BlockDefinition[];
	/** Block by its name (the definition's `name`). */
	readonly byName: (name: string) => BlockDefinition | undefined;
	/** Block by its public renderer (JSX) name (the definition's `component`). */
	readonly byComponent: (component: string) => BlockDefinition | undefined;
}

/**
 * What an extension may rely on while reading (building remark plugins).
 * @experimental
 */
export interface SyntaxContext {
	readonly blocks: SyntaxBlocks;
}

/** Options of {@link SerializeContext.serializeInlines}. */
export interface SerializeInlinesOptions {
	/** The text sits inside a bracketed label, so a `]` in it must be escaped. */
	readonly label?: boolean;
}

/**
 * What an extension may rely on while writing.
 * @experimental
 */
export interface SerializeContext extends SyntaxContext {
	/**
	 * Indentation of the line the node starts on (empty in running text). A `fromDocument` handler places the node at this indentation:
	 * the string it returns must carry the indentation on every line it wants indented. Core adds nothing.
	 */
	readonly indent: string;
	/** `true` while writing text inside a bracketed label (`escapeText` only: core already escapes `]`). */
	readonly label: boolean;
	/** Marks on the text being escaped (`escapeText` only). Empty elsewhere. */
	readonly marks: readonly CmsMark[];
	/** Writes child blocks (joined by blank lines) at `indent` (default: none). */
	serializeBlocks(nodes: readonly CmsNode[], indent?: string): string;
	/** Writes child inlines (text with marks, images, line breaks, nested nodes). */
	serializeInlines(nodes: readonly CmsNode[], options?: SerializeInlinesOptions): string;
	/** Renderer (JSX) name of a node: the name of a JSX node, or its type. Compare with `SyntaxBlocks.byComponent`. */
	componentName(node: CmsNode): string;
	/** Whether the node carries a JSX spread attribute. It cannot be expressed in another notation, so it stays JSX. */
	hasSpread(node: CmsNode): boolean;
	/**
	 * Attributes of a node as `name="value"` / bare `name` parts, in the block definition's order. Booleans are bare when true and omitted
	 * when false; empty and default values are omitted. The caller chooses the enclosure (JSX uses spaces, a directive uses `{…}`).
	 */
	nodeAttributes(node: CmsNode, block: BlockDefinition): string[];
	/** Same as {@link nodeAttributes} for a text mark. Required attributes are written even if empty. */
	markAttributes(mark: CmsMark, block: BlockDefinition): string[];
	/** Escapes a value for a double-quoted attribute. */
	escapeAttribute(value: string): string;
}

/** A writer for one node type. Return `undefined` to defer to the next extension, then to the standard serializer. */
export type SyntaxNodeWriter = (node: CmsNode, context: SerializeContext) => string | undefined;

/** A writer for one mark type. `inner` is the already written content of the mark. Same defer rule. */
export type SyntaxMarkWriter = (mark: CmsMark, inner: string, context: SerializeContext) => string | undefined;

/**
 * A syntax extension.
 *
 * Keys of `fromDocument` are node types (`table`, `image`, or the renderer name of a block such as `Callout`) and keys of `fromMark` are
 * mark types (`underline`, or the block name of an added text block). The key `"*"` matches any type the specific keys did not handle.
 * Core always writes a line break as `<br />` and does not offer it to extensions. An `image` node is offered only when it cannot be written as a Markdown image.
 *
 * @experimental
 */
export interface SyntaxExtension {
	readonly name: string;
	/**
	 * Parsing: remark plugins. They also join the public render chain, so the site renders what the editor parsed.
	 * A function receives the site's blocks (an extension cannot import the site config, which imports the extension).
	 */
	readonly remarkPlugins?: PluggableList | ((context: SyntaxContext) => PluggableList);
	/** CmsNode → MDX. */
	readonly fromDocument?: Readonly<Record<string, SyntaxNodeWriter>>;
	/** Marks this extension writes (for example directive text marks). */
	readonly fromMark?: Readonly<Record<string, SyntaxMarkWriter>>;
	/** Escapes body text so it is not read as this syntax (for example `\:name`). Runs after core's own escaping. */
	readonly escapeText?: (text: string, context: SerializeContext) => string;
}
