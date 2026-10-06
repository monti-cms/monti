import type { CmsJsonValue } from "@monti-cms/core/document";
import type { Root } from "mdast";

export type CmsMdxPosition = {
	line: number;
	column: number;
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

export type CmsJsxAttribute = {
	name?: string;
	value?: CmsJsonValue;
	expression?: string;
	spread?: boolean;
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
