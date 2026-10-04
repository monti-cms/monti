import { createActiveTranslator } from "../i18n/active";
import { defineBlock } from "./define";
import { blockMessages } from "./messages";

/**
 * 본체 블록 정의(v2 B3). 다른 기능이 기대거나 Markdown 문법인 블록만 둔다. 콜아웃·탭 같은 블록과 툴팁·코드 연결·글자색 같은
 * 글자 꾸밈은 블록 확장(`@monti-cms/blocks`)이 플러그인으로 더하고, 사이트는 설정의 `blocks`로 더한다(`blocks/resolve.ts`).
 * 블록을 더하거나 바꾸면 공개 렌더러·에디터 등록부를 함께 확인한다(정의 테스트가 누락을 잡는다).
 */

/**
 * 이름표·설명은 글자를 읽는 때(getter) 사전(`messages.ts`)에서 고른다. 이 파일은 설정 파일이 읽는 모듈이라 사이트 설정을 읽을 수
 * 없어서(순환), 화면 언어는 `i18n/active.ts`가 알려 준다. 정의는 여전히 JSON으로 직렬화할 수 있다(getter도 값으로 담긴다).
 */
const t = createActiveTranslator(blockMessages);
type Key = Parameters<typeof t>[0];

/** `base`에 사전에서 고르는 이름표(`label`)·설명(`description`)을 단다. 키는 `<prefix>.label`·`<prefix>.description`이다. */
function withText<const A extends object, const P extends "label" | "description">(
	base: A,
	prefix: string,
	props: readonly P[],
): A & { readonly [K in P]: string } {
	const result = { ...base };
	for (const prop of props) {
		Object.defineProperty(result, prop, { get: () => t(`${prefix}.${prop}` as Key), enumerable: true });
	}
	return result as A & { readonly [K in P]: string };
}

/** 슬래시 메뉴 검색어: 영어 이름(언어와 상관없이 검색된다) + 사전의 검색어(쉼표로 구분). */
const keywordsOf = (key: Key, ...base: string[]): string[] => [
	...base,
	...t(key)
		.split(",")
		.map((word) => word.trim())
		.filter(Boolean),
];

const ALIGN_OPTIONS = {
	get left() {
		return t("option.left");
	},
	get center() {
		return t("option.center");
	},
	get right() {
		return t("option.right");
	},
};
const ROTATE_OPTIONS = { "0": "0°", "90": "90°", "180": "180°", "270": "270°" } as const;

export const textAlign = defineBlock(
	withText(
		{
			name: "text-align",
			syntax: { kind: "container", directive: "text-align" },
			component: "TextAlign",
			// §4.4 A4: `justify`는 쓰지 않는다. 공개 렌더가 세 값만 고정 클래스로 지원한다.
			attributes: {
				align: withText({ type: "string", required: true, options: ALIGN_OPTIONS } as const, "text-align.align", [
					"label",
				]),
			},
			translateInside: true,
			editor: { view: "attribute" },
		},
		"text-align",
		["label"],
	),
);

export const image = defineBlock(
	withText(
		{
			name: "image",
			syntax: { kind: "leaf", directive: "image" },
			component: "Image",
			attributes: {
				mediaId: withText({ type: "string" } as const, "image.mediaId", ["label", "description"]),
				src: withText({ type: "string" } as const, "image.src", ["label"]),
				alt: withText({ type: "string", translatable: true } as const, "image.alt", ["label", "description"]),
				width: withText({ type: "string" } as const, "image.width", ["label", "description"]),
				align: withText({ type: "string", options: ALIGN_OPTIONS } as const, "image.align", ["label"]),
				caption: withText({ type: "string", translatable: true } as const, "image.caption", ["label"]),
				decorative: withText({ type: "boolean", defaultValue: false } as const, "image.decorative", ["label"]),
				crop: withText({ type: "string" } as const, "image.crop", ["label", "description"]),
				rotate: withText({ type: "string", options: ROTATE_OPTIONS } as const, "image.rotate", [
					"label",
					"description",
				]),
				title: withText({ type: "string", translatable: true } as const, "image.title", ["label", "description"]),
			},
			editor: {
				view: "node",
				nodeView: "image",
				insertable: true,
				get keywords() {
					return keywordsOf("image.keywords", "image");
				},
			},
		},
		"image",
		["label"],
	),
);

/**
 * 첨부 파일 카드(`::file{mediaId="…" label="보고서.pdf"}`, v3). 공개 화면은 이름·크기·형식과 내려받기를 보인다.
 * `label`을 비우면 올린 파일 이름을 쓴다.
 */
export const file = defineBlock(
	withText(
		{
			name: "file",
			syntax: { kind: "leaf", directive: "file" },
			component: "File",
			attributes: {
				mediaId: withText({ type: "string", required: true } as const, "file.mediaId", ["label"]),
				label: withText({ type: "string", translatable: true } as const, "file.label", ["label"]),
			},
			editor: {
				view: "node",
				nodeView: "file",
				insertable: false,
				get keywords() {
					return keywordsOf("file.keywords", "file");
				},
			},
		},
		"file",
		["label"],
	),
);

const textMark = (name: "u" | "sup" | "sub" | "br") =>
	defineBlock(
		withText(
			{
				name,
				syntax: { kind: "text", directive: name },
				component: name,
				attributes: {},
				editor: { view: "mark" },
			} as const,
			name,
			["label"],
		),
	);

/**
 * 번역 안내 글(`:untranslated[원문 글]`, v3). 새 번역본은 원문 글을 이 표시로 감싸 둔다. 에디터는 흐리게 보이고
 * 그 블록에 입력하면 지운다. 공개 화면에는 보이지 않고, 남아 있으면 발행 전 검사가 알린다.
 */
export const untranslated = defineBlock(
	withText(
		{
			name: "untranslated",
			syntax: { kind: "text", directive: "untranslated" },
			component: "Untranslated",
			attributes: {},
			editor: { view: "mark" },
		},
		"untranslated",
		["label"],
	),
);

export const underline = textMark("u");
export const superscript = textMark("sup");
export const subscript = textMark("sub");
export const lineBreak = textMark("br");

export const math = defineBlock(
	withText(
		{
			name: "math",
			syntax: { kind: "math" },
			component: "Math",
			renderedBy: "rehype-katex",
			attributes: {},
			editor: {
				view: "node",
				nodeView: "math",
				insertable: true,
				get keywords() {
					return keywordsOf("math.keywords", "math", "katex");
				},
				icon: "sigma",
			},
		},
		"math",
		["label", "description"],
	),
);

export const table = defineBlock(
	withText(
		{
			name: "table",
			syntax: { kind: "container", directive: "table" },
			component: "Table",
			attributes: {
				align: withText({ type: "string" } as const, "table.align", ["label", "description"]),
				widths: withText({ type: "string" } as const, "table.widths", ["label", "description"]),
			},
			children: { blocks: ["row"], min: 1 },
			editor: {
				view: "opaque",
				insertable: false,
				get keywords() {
					return keywordsOf("table.keywords", "table");
				},
			},
		},
		"table",
		["label", "description"],
	),
);

export const row = defineBlock(
	withText(
		{
			name: "row",
			syntax: { kind: "container", directive: "row" },
			component: "TableRow",
			attributes: {},
			children: { blocks: ["cell"], min: 1 },
			parent: "table",
			editor: { view: "opaque" },
		},
		"row",
		["label"],
	),
);

export const cell = defineBlock(
	withText(
		{
			name: "cell",
			syntax: { kind: "leaf", directive: "cell" },
			component: "TableCell",
			attributes: {
				colspan: withText({ type: "string" } as const, "cell.colspan", ["label"]),
				rowspan: withText({ type: "string" } as const, "cell.rowspan", ["label"]),
				header: withText({ type: "boolean", defaultValue: false } as const, "cell.header", ["label"]),
			},
			parent: "row",
			editor: { view: "opaque" },
		},
		"cell",
		["label"],
	),
);

/** 본체 블록. 선언 순서가 `/meta`와 문서의 순서다. 사이트가 쓰는 블록은 `blocks/active.ts`의 `BLOCKS`다. */
export const BUILTIN_BLOCKS = [
	textAlign,
	image,
	file,
	untranslated,
	underline,
	superscript,
	subscript,
	lineBreak,
	math,
	table,
	row,
	cell,
] as const;
