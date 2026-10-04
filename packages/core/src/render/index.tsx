/**
 * 본문 그리기(`@monti-cms/core/render`, M14-2). 공개본 MDX를 React로 그린다. remark·rehype 순서는 본체가 정하고(편집기와 같은 문법),
 * 컴포넌트는 본체 기본(링크·이미지·파일·표·정렬·코드 줄) → 블록 확장의 공개 컴포넌트(플러그인 `render`) → 사이트가 넘긴 것 순으로
 * 덮어쓴다. 서버 컴포넌트에서 부른다.
 */
import type { Root, Text } from "mdast";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkDirective from "remark-directive";
import remarkFlexibleToc, { type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { PluggableList } from "unified";
import { visit } from "unist-util-visit";
import { annotationConfig } from "../annotation/code-block/active";
import { cmsConfig } from "../config/resolved";
import { analyze } from "../mdx/analyze";
import type { ImageResolver } from "../mdx/image-src";
import { remarkDemoteUnknownDirectives, remarkDirectivesToMdx } from "../mdx/remark-directives";
import { remarkFenceBlocksToMdx } from "../mdx/remark-fence-blocks";
import type { CmsPlugin } from "../plugin/define";
import { type CodeHighlightOptions, rehypeShikiDecorationRender, remarkAnnotationToShikiDecoration } from "./code";
import { CmsCodeCollapse, CmsCodeFold } from "./components/code-lines";
import { CmsFile } from "./components/file";
import { CmsImage } from "./components/image";
import { CmsLink } from "./components/link";
import { CmsPre } from "./components/pre";
import { CmsTable, CmsTableCell, CmsTableRow } from "./components/table";
import { CmsTextAlign } from "./components/text-align";

// biome-ignore lint/suspicious/noExplicitAny: MDX 컴포넌트 표는 요소마다 속성이 다르다
export type MdxComponents = Record<string, ComponentType<any>>;

/** 본체 기본 컴포넌트의 고정 문구. 사이트 언어로 넘긴다. */
export interface RenderLabels {
	readonly imageUnavailable: string;
	readonly fileUnavailable: string;
	readonly download: string;
	readonly showFoldedCode: string;
	readonly copyCode: string;
	readonly copied: string;
	readonly codeNotes: string;
}

const DEFAULT_LABELS: RenderLabels = {
	imageUnavailable: "Image unavailable",
	fileUnavailable: "File unavailable",
	download: "Download",
	showFoldedCode: "Show folded code",
	copyCode: "Copy",
	copied: "Copied",
	codeNotes: "Code notes",
};

export interface RenderMdxOptions {
	/** 본문 이미지·파일 주소 해석기(`createPublicImageResolver(mdx)`). 없으면 바깥 `src`만. */
	readonly imageResolver?: ImageResolver;
	/** 공개 화면의 언어. 블록 공개 컴포넌트가 받는다. */
	readonly locale?: string;
	/** 본문의 사이트 안 링크를 바꾼다(예: 같은 언어 번역본 주소로). */
	readonly resolveHref?: (href: string) => string;
	/** 덮어쓸 컴포넌트(이름 → 컴포넌트). 블록 이름은 블록 정의의 `component`다. */
	readonly components?: MdxComponents;
	readonly labels?: Partial<RenderLabels>;
	/** 코드 강조(언어·테마). */
	readonly code?: CodeHighlightOptions;
	/** 본체 플러그인 뒤에 더할 remark·rehype 플러그인. */
	readonly remarkPlugins?: PluggableList;
	readonly rehypePlugins?: PluggableList;
}

/** 블록 확장이 주는 공개 컴포넌트(플러그인 `render`). 사이트 언어·해석기를 받는다. */
export interface PluginRenderContext {
	readonly locale?: string;
	readonly imageResolver?: ImageResolver;
}

/** 본문의 단일 `$`를 수식으로 보지 않는다(편집기 파서와 같게). `$…$`는 글자로 되돌린다. */
const remarkDisableInlineMath = () => (tree: Root) => {
	visit(tree, "inlineMath", (node, index, parent) => {
		if (index == null || !parent) return;
		parent.children.splice(index, 1, { type: "text", value: `$${node.value}$` } satisfies Text);
	});
};

/** 본체 remark 순서. 편집기·검수 러너가 같은 구성을 쓴다. */
export const mdxRemarkPlugins = (tocRef: TocItem[] = []): PluggableList => [
	[remarkAnnotationToShikiDecoration, annotationConfig],
	[remarkMath, { singleDollarTextMath: false }],
	remarkDisableInlineMath,
	// 미등록 지시자를 본문 글자로 되돌린 뒤 등록된 이름만 MDX 요소로 바꾼다(순서를 바꾸면 미등록 이름이 사라진다).
	remarkDirective,
	remarkDemoteUnknownDirectives,
	remarkDirectivesToMdx,
	// 코드 펜스 블록(차트·다이어그램 등)은 `<블록 source="…"/>`로 바꾼다.
	remarkFenceBlocksToMdx,
	remarkBreaks,
	remarkGfm,
	[remarkFlexibleToc, { tocRef, maxDepth: 3 }],
];

/** 본체 rehype 순서. */
export const mdxRehypePlugins = (code?: CodeHighlightOptions): PluggableList => [
	rehypeSlug,
	rehypeAutolinkHeadings,
	[rehypeKatex, { output: "htmlAndMathml", throwOnError: false }],
	[rehypeShikiDecorationRender, code ?? {}],
];

/** 본체 기본 컴포넌트. */
export function defaultMdxComponents(options: RenderMdxOptions = {}): MdxComponents {
	const labels = { ...DEFAULT_LABELS, ...options.labels };
	const resolveHref = options.resolveHref;
	return {
		a: resolveHref
			? (props: ComponentProps<typeof CmsLink>) => <CmsLink {...props} href={resolveHref(props.href ?? "")} />
			: CmsLink,
		pre: (props: ComponentProps<typeof CmsPre>) => (
			<CmsPre {...props} copyLabel={labels.copyCode} copiedLabel={labels.copied} notesLabel={labels.codeNotes} />
		),
		collapse: CmsCodeCollapse,
		fold: (props: ComponentProps<typeof CmsCodeFold>) => <CmsCodeFold {...props} label={labels.showFoldedCode} />,
		// 번역 안내 글은 공개 화면에 보이지 않는다(남은 채로 발행하지 않게 발행 전 검사가 막는다).
		Untranslated: () => null,
		TextAlign: CmsTextAlign,
		Image: (props: ComponentProps<typeof CmsImage>) => (
			<CmsImage {...props} resolve={options.imageResolver} unavailableLabel={labels.imageUnavailable} />
		),
		File: (props: ComponentProps<typeof CmsFile>) => (
			<CmsFile
				{...props}
				resolve={options.imageResolver}
				downloadLabel={labels.download}
				unavailableLabel={labels.fileUnavailable}
			/>
		),
		Table: CmsTable,
		TableRow: CmsTableRow,
		TableCell: CmsTableCell,
		// GFM 표의 첫 행 머리글은 열 머리글이다. 지시자 표는 TableCell이 행·열을 가린다.
		th: ({ scope, ...props }: ComponentProps<"th">) => <th {...props} scope={scope ?? "col"} />,
	};
}

type RenderPluginModule = {
	readonly default: (context: PluginRenderContext) => MdxComponents | Promise<MdxComponents>;
};

/** 플러그인의 공개 컴포넌트를 불러오는 함수(`definePlugin`의 `render`). */
const renderModules = (): Promise<RenderPluginModule[]> => {
	const plugins: readonly CmsPlugin[] = cmsConfig.plugins ?? [];
	loaded ??= Promise.all(
		plugins.flatMap((plugin) => (plugin.render ? [plugin.render() as Promise<RenderPluginModule>] : [])),
	);
	return loaded;
};
let loaded: Promise<RenderPluginModule[]> | undefined;

/** 본체 기본 → 블록 확장 → 사이트 순으로 합친 컴포넌트 표. */
export async function mdxComponents(options: RenderMdxOptions = {}): Promise<MdxComponents> {
	const context: PluginRenderContext = { locale: options.locale, imageResolver: options.imageResolver };
	const fromPlugins = await Promise.all((await renderModules()).map((module) => module.default(context)));
	return Object.assign(defaultMdxComponents(options), ...fromPlugins, options.components);
}

export interface RenderedMdx {
	readonly content: ReactNode;
	/** 제목 목차(h2부터 깊이 1). */
	readonly toc: readonly TocItem[];
}

/**
 * 공개본 MDX를 그린다. 검사(`analyze`)에 걸리는 본문은 실행 컴파일러에 넣지 않고 오류를 던진다(M7-SEC-1, 발행 경계를 지난
 * 본문도 다시 막는다).
 */
export async function renderMdx(source: string, options: RenderMdxOptions = {}): Promise<RenderedMdx> {
	const errors = analyze(source).errors;
	if (errors.length > 0) throw new Error(`MDX validation failed: ${errors[0]?.message ?? "unknown"}`);
	const tocRef: TocItem[] = [];
	const { content } = await compileMDX({
		source,
		options: {
			mdxOptions: {
				remarkPlugins: [...mdxRemarkPlugins(tocRef), ...(options.remarkPlugins ?? [])],
				rehypePlugins: [...mdxRehypePlugins(options.code), ...(options.rehypePlugins ?? [])],
			},
		},
		components: await mdxComponents(options),
	});
	return { content, toc: tocRef.map((item) => ({ ...item, depth: (item.depth - 2) as TocItem["depth"] })) };
}

export type { TocItem } from "remark-flexible-toc";

/** 공개 MDX가 등록 미디어를 공개 주소로 해석하는 해석기(서버 전용). */
export { createPublicImageResolver } from "../mdx/public-image-resolver";
