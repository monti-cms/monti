import type { Root } from "mdast";

export type CmsMdxPosition = {
	line: number;
	column: number;
};

/**
 * MDX 분석 오류 코드. 바뀌지 않는 값이라 화면이 코드로 문구를 고를 수 있다. `mdx_syntax`는 파서가 준 말을 `message`에 그대로 담는다.
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
	/** 문구의 값 자리(`{name}` 등)를 채우는 값. */
	params?: Record<string, string | number>;
	/** 사이트 화면 언어(`admin.locale`)의 안내 문구. 코드와 값에서 `cms.mdx` 사전으로 만든다. */
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
 * 본문에 쓰인 이미지 소스. **DB 의미가 없는 순수 사실이다** — `mediaId`가 실제 미디어 행을
 * 가리키는지, 그 행이 `ready`인지는 발행 전 검사가 판단한다.
 */
export type CmsImageSource = {
	/** 등록 미디어 참조. `src`와 배타적이다. */
	readonly mediaId?: string;
	/** 외부 주소. */
	readonly src?: string;
	readonly position: CmsMdxPosition;
};
