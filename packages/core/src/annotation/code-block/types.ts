export type Range = {
	start: number;
	end: number;
};

export type AnnotationAttr = { name: string; value: unknown };

type AnnotationBase = {
	scope: AnnotationScope;
	name: string;
	range: Range;
	priority: number; // 교차 겹침 시 well nested 정책 우선 순위
	order: number; // 작성 순서
	class?: string;
	render?: string;
	attributes?: AnnotationAttr[];
};

export type InlineAnnotationSource = "mdast" | "mdx-text";
export type InlineAnnotation = AnnotationBase & {
	scope: "char" | "document";
	source: InlineAnnotationSource;
	/** 정규식 규칙(`{re:/.../}`)으로 찾은 범위면 그 규칙의 `CodeBlockDocument.rules` 번호. */
	rule?: number;
};

export type LineAnnotation = AnnotationBase & {
	scope: "line";
};

export type CodeBlockAnnotation = InlineAnnotation | LineAnnotation;

export type AnnotationScope = "char" | "line" | "document";
export type AnnotationKind = "class" | "render";

export type AnnotationRegistryItem = {
	name: string;
	kind: AnnotationKind;
	class?: string;
	render?: string;
	source: InlineAnnotationSource;
	scopes: AnnotationScope[];
	priority: number;
};

export type AnnotationRegistry = Map<string, AnnotationRegistryItem>;

type ClassAnnotationConfigItem = {
	name: string;
	kind: "class";
	class: string;
	source?: InlineAnnotationSource;
	scopes?: AnnotationScope[];
};

type RenderAnnotationConfigItem = {
	name: string;
	kind: "render";
	render: string;
	source?: InlineAnnotationSource;
	scopes?: AnnotationScope[];
};

export type AnnotationConfigItem = ClassAnnotationConfigItem | RenderAnnotationConfigItem;

export interface AnnotationConfig {
	annotations?: AnnotationConfigItem[];
}

export type Line = { value: string; annotations: InlineAnnotation[] };

export type CodeBlockMetaValue = string | boolean;

/**
 * 정규식으로 범위를 찾는 주석 규칙. 저장할 때 찾은 범위(고정 위치)가 아니라 규칙 그대로 쓴다.
 * - `char`: `line` 번째 줄에서만 찾는다(`// @char fold {re:/.../}`를 그 줄 바로 위에 둔다).
 * - `document`: 코드 전체에서 찾는다.
 */
export type CodeBlockRule = {
	scope: "char" | "document";
	name: string;
	pattern: string;
	flags: string;
	line?: number;
	attributes: AnnotationAttr[];
};

export type CodeBlockDocument = {
	lang: string;
	meta: Record<string, CodeBlockMetaValue>;
	annotations: LineAnnotation[];
	lines: Array<Line>;
	rules?: CodeBlockRule[];
};
