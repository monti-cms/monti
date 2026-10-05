import type { Root } from "mdast";

export type CmsMdxPosition = {
	line: number;
	column: number;
};

/** A place in a body that also names the block of the stored document it is in (`blockId`). The block is unknown when the body has no document. */
export type CmsBodyPosition = CmsMdxPosition & {
	readonly blockId?: string;
};

/**
 * MDX analysis error code. The value never changes, so the screen can pick a message by code. For `mdx_syntax`, the parser's message is put into `message` as is.
 */
export type CmsMdxErrorCode =
	| "spread_attribute"
	| "call_expression"
	| "identifier_reference"
	| "unsupported_expression"
	| "retired_jsx_element"
	| "disallowed_jsx_element"
	| "event_handler_attribute"
	| "esm_not_allowed"
	| "child_count_range"
	| "child_count_min"
	| "parse_failed"
	| "mdx_syntax";

export type CmsMdxError = {
	code: CmsMdxErrorCode;
	/** Values that fill the placeholders (`{name}` etc.) of the message. */
	params?: Record<string, string | number>;
	/** Guidance message in the site's screen language (`admin.locale`). Built from the code and values with the `cms.mdx` dictionary. */
	message: string;
	position: CmsMdxPosition;
};

export type CmsJsonValue = string | number | boolean | null | CmsJsonValue[] | { [key: string]: CmsJsonValue };

export type CmsJsxAttribute = {
	name?: string;
	value?: CmsJsonValue;
	expression?: string;
	spread?: boolean;
};

export type CmsMark = {
	type: string;
	attrs?: Record<string, CmsJsonValue>;
};

export type CmsNode = {
	type: string;
	/** Block id, unique within the document (`block-ids.ts`). Only blocks of a stored document carry one; never written to MDX. */
	id?: string;
	attrs?: Record<string, CmsJsonValue>;
	content?: CmsNode[];
	marks?: CmsMark[];
	text?: string;
};

export type CmsMdxAnalysis = {
	source: string;
	errors: CmsMdxError[];
	name?: string;
	frontmatter: Record<string, CmsJsonValue> | null;
	/** Number of source lines before the parsed MDX body (frontmatter offset). */
	sourceLineOffset: number;
	tree: Root | null;
};

/**
 * Image source used in the body. **Pure fact with no DB meaning** — whether `mediaId` actually points to
 * a media row and whether that row is `ready` is decided by the pre-publish check.
 */
export type CmsImageSource = {
	/** Registered media reference. Mutually exclusive with `src`. */
	readonly mediaId?: string;
	/** External address. */
	readonly src?: string;
	readonly position: CmsBodyPosition;
};
