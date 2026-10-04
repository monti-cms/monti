/**
 * 본문 블록 정의 규격(v2 B3). 블록 하나의 저장 문법, 설정 속성, 자식 규칙, 편집 방식, 공개 렌더러를 한 곳에서 정한다.
 *
 * 정의는 서버(저장 검증)·에디터·공개 렌더러·`/meta`가 함께 쓰므로 **JSON으로 직렬화할 수 있는 값만** 가진다.
 * 편집 UI(NodeView·설정 폼)와 공개 컴포넌트는 이름으로만 가리키고, 구현은 각 등록부에 둔다:
 *
 * - 공개 렌더러: 사이트의 MDX 컴포넌트 표(`component` 이름)
 * - 에디터: 본체 블록(이미지·파일·수식)은 관리자 패키지의 `editor/block-views.ts`(`editor.nodeView` 이름)다. 더한 블록은
 *   관리자 패키지가 정의에서 편집기 노드를 만들고, 편집 화면은 `CmsAdminComponentsProvider`의 `blockViews`(전체)나
 *   `blockEditors`(속성·본문 상자)로 받는다. 둘 다 없으면 기본 상자다.
 *
 * 사이트는 설정의 `blocks`로, 블록 확장(예: `@monti-cms/blocks`)은 플러그인의 `blocks`로 블록을 더한다(`blocks/resolve.ts`).
 */

/** 저장 문법. 지시자(§4.4)는 `:::이름`·`::이름`·`:이름[...]`, 코드 펜스는 ` ```언어 `, 수식은 `$$`다. */
export type BlockSyntax =
	| { readonly kind: "container"; readonly directive: string }
	| { readonly kind: "leaf"; readonly directive: string }
	| { readonly kind: "text"; readonly directive: string }
	| { readonly kind: "fence"; readonly lang: string }
	| { readonly kind: "math" };

export interface BlockAttribute {
	readonly type: "string" | "boolean";
	readonly label: string;
	readonly description?: string;
	/** 비어 있으면 발행을 막는다(§4.4, 초안 저장은 막지 않는다). */
	readonly required?: boolean;
	/** 고를 수 있는 값 → 라벨. 있으면 다른 값은 발행을 막는다. */
	readonly options?: Readonly<Record<string, string>>;
	readonly defaultValue?: string | boolean;
	/** 설정 폼 입력. 없으면 종류에 맞는 기본 입력(한 줄·체크·선택)이다. */
	readonly input?: "textarea";
	/** 번역할 글자(예: 제목·탭 이름). 번역 화면이 머리 줄로 따로 번역한다. */
	readonly translatable?: boolean;
	/** 값이 자식 블록의 이 속성 값 중 하나여야 한다(예: 처음 열 탭 → 탭 이름). 발행 전 검사가 확인한다. */
	readonly childValue?: string;
	/**
	 * 값이 같은 글 코드 블록의 줄 이름표(코드 펜스 주석 `anchor` 줄 효과의 `id`)다. 글자 꾸밈 블록(`view: "mark"`) 하나만
	 * 단다. 관리자 편집기가 이 블록으로 본문 글자와 코드 줄을 잇는다(줄 고르기·잇기 안내·마우스를 올린 줄 강조).
	 */
	readonly codeAnchor?: boolean;
}

export interface BlockChildren {
	/** 자식으로 올 수 있는 블록 이름. 없으면 일반 본문 블록(문단·목록 등)을 담는다. */
	readonly blocks?: readonly string[];
	/** 최소 개수. 본문을 담는 컨테이너는 0이면 본문 없이 둘 수 있다(없으면 1). */
	readonly min?: number;
	readonly max?: number;
}

/** 슬래시 메뉴로 넣을 때의 처음 값. */
export interface BlockInsert {
	/** 처음 속성 값. 없으면 속성의 기본값(`defaultValue`)이다. */
	readonly values?: Readonly<Record<string, string | boolean>>;
	/** 본문 첫 문단의 글자. 없으면 빈 문단이다. */
	readonly text?: string;
	/** 코드 펜스 블록의 처음 코드. */
	readonly code?: string;
	/** 자식 블록마다의 처음 값. 없으면 최소 개수만큼 기본값으로 넣는다. */
	readonly children?: readonly Omit<BlockInsert, "children" | "code">[];
}

/**
 * 에디터 표현.
 *
 * - `opaque`: 원문을 보존하는 읽기 전용 상자(원문 모드에서 편집). 삽입 UI가 없는 블록의 기본값이다.
 * - `node`: 전용 NodeView(`nodeView` 이름)로 편집한다.
 * - `mark`: 글자 꾸밈(인라인 지시자 `:이름[글자]{속성}`). 더한 블록이면 관리자 편집기가 정의에서 글자 표시를 만들고,
 *   고르기 도구·버블은 확장이 `CmsAdminComponentsProvider`의 `marks`로 준다.
 * - `attribute`: 다른 노드의 속성으로 표현한다(예: 문단 정렬).
 */
export interface BlockEditor {
	readonly view: "opaque" | "node" | "mark" | "attribute";
	readonly nodeView?: string;
	/** 슬래시 메뉴에 보인다. */
	readonly insertable?: boolean;
	/** 슬래시 메뉴 검색어. */
	readonly keywords?: readonly string[];
	/** 메뉴 아이콘(lucide 이름, 예: `workflow`). 없으면 퍼즐 아이콘이다. */
	readonly icon?: string;
	/** 슬래시 메뉴로 넣을 때의 처음 값. */
	readonly insert?: BlockInsert;
	/** 코드 펜스 블록이 비었을 때 보일 글. */
	readonly placeholder?: string;
}

export interface BlockDefinition {
	/** 정의 이름(소문자 케밥). 지시자 블록은 저장 문법의 이름과 같다. */
	readonly name: string;
	readonly label: string;
	readonly description?: string;
	readonly syntax: BlockSyntax;
	/** 공개 렌더러 이름. 대문자는 `MDX_COMPONENTS`의 컴포넌트, 소문자는 HTML 요소다. */
	readonly component: string;
	/** 컴포넌트가 아니라 렌더 플러그인이 그리면 그 이름(예: 수식은 `rehype-katex`). */
	readonly renderedBy?: string;
	readonly attributes: Readonly<Record<string, BlockAttribute>>;
	/** 자식 규칙. 없으면 자식을 받지 않거나(leaf·fence) 일반 본문을 담는다(container). */
	readonly children?: BlockChildren;
	/** 이 블록 안에서만 쓸 수 있다(예: `tab`은 `tabs` 안). */
	readonly parent?: string;
	/** 번역 화면이 상자를 펼쳐 안쪽 블록을 하나씩 번역한다(없으면 블록 전체가 한 단위다). */
	readonly translateInside?: boolean;
	readonly editor: BlockEditor;
}

export const defineBlock = <const B extends BlockDefinition>(definition: B): B => definition;
