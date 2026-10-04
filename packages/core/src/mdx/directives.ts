import { directiveBlocks } from "../blocks/derive";

/**
 * 지시자 이름 정의표.
 *
 * 저장 형식과 렌더러가 함께 보는 표다. 블록 정의(`blocks/definitions.ts`)에서 만든다.
 * 블록을 더할 때는 블록 정의를 고친다.
 *
 * 등록된 이름만 지시자로 인식한다. 미등록 `:이름`은 파싱 단계에서 본문 텍스트로 되돌린다
 * (`remark-directive`에는 이름 필터 옵션이 없다 — "It exports no additional options.").
 */

export type DirectiveKind = "container" | "leaf" | "text";

export type DirectiveAttributeType = "string" | "boolean";

export type DirectiveDefinition = {
	/** 저장 문법의 이름(소문자 케밥). */
	name: string;
	/** 지시자 종류. 미등록 노드를 되돌릴 때 문맥을 정한다(text → text, 나머지 → paragraph). */
	kind: DirectiveKind;
	/** 렌더에 쓰는 요소/컴포넌트 이름. 소문자는 MDX intrinsic 요소다. */
	component: string;
	/** 속성 이름 → 타입. 여기 없는 속성은 발행 전 검사가 경고한다(M8-TW-1). */
	attributes: Record<string, DirectiveAttributeType>;
	/** 필수 속성. 없으면 발행 전 검사가 거부한다(M8-TW-1). */
	required: readonly string[];
};

/** 블록 정의(v2 B3, `blocks/definitions.ts`)에서 만든 지시자 표. */
export const DIRECTIVES: readonly DirectiveDefinition[] = directiveBlocks().map((block) => {
	const syntax = block.syntax as { kind: DirectiveKind; directive: string };
	return {
		name: syntax.directive,
		kind: syntax.kind,
		component: block.component,
		attributes: Object.fromEntries(Object.entries(block.attributes).map(([name, attribute]) => [name, attribute.type])),
		required: Object.entries(block.attributes)
			.filter(([, attribute]) => attribute.required)
			.map(([name]) => name),
	};
});

export const DIRECTIVE_BY_NAME: ReadonlyMap<string, DirectiveDefinition> = new Map(
	DIRECTIVES.map((definition) => [definition.name, definition]),
);

export const isRegisteredDirective = (name: string): boolean => DIRECTIVE_BY_NAME.has(name);

/** 등록된 지시자 이름 집합. 저장할 때 본문 텍스트와 구분하는 데 쓴다(§4.4 `\:` 규칙). */
export const DIRECTIVE_NAMES: ReadonlySet<string> = new Set(DIRECTIVES.map((definition) => definition.name));

/** 컴포넌트 이름 → 정의. 쓰기 경로(serializer)가 JSX 이름으로 directive를 찾을 때 쓴다. */
export const DIRECTIVE_BY_COMPONENT: ReadonlyMap<string, DirectiveDefinition> = new Map(
	DIRECTIVES.map((definition) => [definition.component, definition]),
);

export { TEXT_ALIGN_VALUES } from "../blocks/derive";
