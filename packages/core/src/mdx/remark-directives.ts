/**
 * remark directive 두 단계 플러그인.
 *
 * 1. {@link remarkDemoteUnknownDirectives} — **등록되지 않은** 이름을 원문 그대로의 본문 텍스트로 되돌린다.
 *    directive를 처리하지 않는 파이프라인은 아무것도 출력하지 않으므로(무음 손실), 되돌리지 않으면
 *    `openai/gpt-oss-120b:free를` 같은 산문이 사라진다. 레거시 49편 실측 오탐은 2건이다(`:free를`, `:1로`).
 * 2. {@link remarkDirectivesToMdx} — **등록된** 이름을 MDX 요소로 바꾼다. 컴포넌트는 이름으로만 붙으므로
 *    (`MDX_COMPONENTS`) `mdxJsxFlowElement`·`mdxJsxTextElement`로 변환해야 한다.
 *    코드 펜스 블록을 MDX 요소로 바꾸는 `remark-fence-blocks.ts`와 같은 방식이다.
 *
 * 두 플러그인은 순서가 있다. demote를 먼저 돌려 미등록 이름을 걷어낸 뒤 변환한다.
 * **CMS 파서(`parseMdxAst`)와 공개 렌더 체인이 둘 다 쓴다.** 저장 문자열은 바뀌지 않고 분석기가 보는
 * 트리만 공개 체인과 같은 모양이 된다 — 참조 수집·속성 검증이 **이름으로 노드를 찾으므로**
 * 두 shape로 갈라지면 한쪽만 고치는 실수가 난다.
 */

import type { Paragraph, Root, RootContent } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { DIRECTIVE_BY_NAME, type DirectiveDefinition } from "./directives";

/** remark-directive가 만드는 세 가지 노드 타입. */
const DIRECTIVE_TYPES = ["containerDirective", "leafDirective", "textDirective"] as const;

type DirectiveNode = {
	type: (typeof DIRECTIVE_TYPES)[number];
	name: string;
	attributes?: Record<string, string | null> | null;
	children?: unknown[];
	position?: {
		start?: { offset?: number; column?: number };
		end?: { offset?: number };
	};
};

const asDirective = (node: unknown): DirectiveNode => node as DirectiveNode;

/**
 * 노드가 차지한 **원문 문자열**을 그대로 잘라 온다.
 *
 * AST에서 directive 문자열을 재조립하지 않는다 — 이스케이프·공백·따옴표가 틀어진다.
 */
const originalSource = (node: DirectiveNode, source: string): string => {
	const start = node.position?.start?.offset;
	const end = node.position?.end?.offset;
	if (typeof start !== "number" || typeof end !== "number") {
		// 원문을 보존할 수 없으면 조용히 잃는 것보다 멈추는 편이 낫다(analyze가 오류로 보고한다).
		throw new Error(`Can't preserve the body: the position of directive :${node.name} is unknown`);
	}
	return source.slice(start, end);
};

/**
 * 블록 지시자의 원문. 둘째 줄부터는 바깥 블록이 붙인 접두(인용 `> `·목록 들여쓰기)를 지시자가 시작한 칸까지 걷어 낸다.
 * 그대로 두면 바깥 블록을 다시 쓸 때 접두가 한 번 더 붙어 저장할 때마다 겹친다(`> > `).
 */
const blockSource = (node: DirectiveNode, source: string): string => {
	const original = originalSource(node, source);
	const width = (node.position?.start?.column ?? 1) - 1;
	if (width <= 0) return original;
	return original
		.split("\n")
		.map((line, index) => (index > 0 && /^[ \t>]*$/.test(line.slice(0, width)) ? line.slice(width) : line))
		.join("\n");
};

/**
 * 되돌린 블록 지시자 문단에 붙이는 표시(`paragraph.data`). 공개 렌더에는 그냥 글 문단이지만, 쓰기 경로
 * (`toDocument`)는 이 문단을 원문 블록(`html`)으로 옮겨 이스케이프 없이 그대로 쓴다. 원문은 마크다운으로 읽힌 글이 아니라서
 * 글처럼 이스케이프하면 다시 읽을 때 풀리지 않고 저장할 때마다 백슬래시가 는다(`\{` → `\\\{`).
 */
export const DEMOTED_DIRECTIVE_SOURCE = "cmsDemotedDirectiveSource";

/**
 * 미등록 directive를 본문 텍스트로 되돌린다.
 *
 * - 텍스트 directive → `text` (문장 안이므로 문맥이 같다)
 * - 리프·컨테이너 directive → `paragraph(text)` (블록 문맥). 쓰기 경로가 원문 그대로 쓰도록 {@link DEMOTED_DIRECTIVE_SOURCE}를 붙인다.
 * - 미등록 부모는 **subtree 전체를 원문으로 보존**하고 자식 순회를 멈춘다(내부를 변환하면 계약이 깨진다).
 */
export const remarkDemoteUnknownDirectives =
	() =>
	(tree: Root, file: VFile): undefined => {
		const source = typeof file?.value === "string" ? file.value : "";

		visit(tree, [...DIRECTIVE_TYPES], (node, index, parent) => {
			const directive = asDirective(node);
			if (DIRECTIVE_BY_NAME.has(directive.name)) return;
			if (!parent || index == null) return;

			const replacement: RootContent =
				directive.type === "textDirective"
					? { type: "text", value: originalSource(directive, source) }
					: {
							type: "paragraph",
							// mdast의 문단 data 타입에는 없는 이름이라 넓혀 둔다. 공개 렌더(mdast → hast)는 모르는 data를 무시한다.
							data: { [DEMOTED_DIRECTIVE_SOURCE]: true } as Paragraph["data"],
							children: [{ type: "text", value: blockSource(directive, source) }],
						};

			(parent.children as RootContent[]).splice(index, 1, replacement);
			return [SKIP, index];
		});
	};

/**
 * 지시자 속성을 MDX 속성으로 바꾼다.
 *
 * 불리언은 **거짓일 때 속성을 아예 쓰지 않는다.** `={false}` 표현식을 만들지 않으면서
 * `"false"`가 truthy가 되는 함정(A1)을 피한다 — `decorative="false"`와 생략이 같은 뜻이 된다.
 */
const toMdxAttributes = (
	definition: DirectiveDefinition,
	raw: Record<string, string | null> | null | undefined,
): { type: "mdxJsxAttribute"; name: string; value: string | null }[] => {
	const attributes: { type: "mdxJsxAttribute"; name: string; value: string | null }[] = [];

	for (const [name, value] of Object.entries(raw ?? {})) {
		const kind = definition.attributes[name];
		if (kind === "boolean") {
			if (value !== null && value.toLowerCase() === "false") continue;
			attributes.push({ type: "mdxJsxAttribute", name, value: null });
			continue;
		}
		// 정의에 없는 속성도 버리지 않는다(조용한 손실 금지). 허용 여부는 발행 전 검사가 다룬다.
		attributes.push({ type: "mdxJsxAttribute", name, value: value ?? null });
	}

	return attributes;
};

/**
 * 등록된 directive를 MDX 요소로 바꾼다.
 *
 * `u`·`sup`·`sub`·`br`은 소문자 intrinsic 요소로, 나머지는 `MDX_COMPONENTS`에 등록된 컴포넌트 이름으로 매핑한다.
 */
export const remarkDirectivesToMdx =
	() =>
	(tree: Root): undefined => {
		visit(tree, [...DIRECTIVE_TYPES], (node, index, parent) => {
			const directive = asDirective(node);
			const definition = DIRECTIVE_BY_NAME.get(directive.name);
			// 등록되지 않은 이름은 demote가 이미 걷어갔다. 방어적으로 남긴다.
			if (!definition) return;
			if (!parent || index == null) return;

			const attributes = toMdxAttributes(definition, directive.attributes);
			// 라벨/본문 자식을 그대로 넘긴다. 컨테이너는 블록, 텍스트는 인라인 문맥이라 타입이 다르지만
			// 여기서는 remark-directive가 만든 노드를 그대로 옮기는 것이라 좁히지 않고 넘긴다.
			const children = directive.children ?? [];
			const replacement = {
				// 위치를 복사한다. 잃으면 이미지 경고·미디어 참조 위치가 늘 1:1로 보고된다(R1 P2).
				...(directive.position ? { position: directive.position } : {}),
				type: directive.type === "textDirective" ? "mdxJsxTextElement" : "mdxJsxFlowElement",
				name: definition.component,
				attributes,
				children,
			} as unknown as RootContent;

			(parent.children as RootContent[]).splice(index, 1, replacement);
			// 등록된 컨테이너의 자식도 순회한다(콜아웃 안 병합 표 등). 미등록 지시자는 demote 단계에서 SKIP한다.
			return definition.kind === "container" ? index : [SKIP, index];
		});
	};
