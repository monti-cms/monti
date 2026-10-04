"use client";

import type { Field, TextChecker } from "@monti-cms/core/client";
import type { ListEntriesItem } from "@monti-cms/core/runtime";
import type { Editor, NodeViewProps } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import {
	type ComponentType,
	createContext,
	Fragment,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
} from "react";
import type { EditorMarkSpec } from "./editor/added-marks";
import type { CustomBlockEditorProps } from "./editor/blocks/added/view";
import type { ActiveInlineMark } from "./editor/inline-marks";
import { useTextCheckEditor } from "./editor/text-check/extension";
import type { BlockAction } from "./editor/tiptap-editor";
import type { EntryData, EntryForm } from "./screens/entries/entry-form";
import type { FieldInputProps } from "./screens/entries/field-inputs";

/**
 * 편집 화면 확장(플러그인 등)이 받는 지금 상황. 매 렌더 부르는 훅이므로 안에서 React 훅을 써도 된다.
 * 확장 목록은 관리자 화면이 떠 있는 동안 바뀌지 않아야 한다(훅 순서).
 */
export interface EditorExtensionContext {
	/** 번역본을 편집 중이면 원문·번역 언어. 원문이면 `null`. */
	readonly translateLocales: { readonly sourceLocale: string; readonly targetLocale: string } | null;
	/** 누를 때 읽는 편집 중인 글(제목·컬렉션·언어·ID). */
	readonly getEntry?: () => {
		readonly title: string;
		readonly collection: string;
		readonly locale?: string;
		readonly entryId?: string;
	};
}

/** 글자를 고르면 뜨는 인라인 메뉴에 더하는 동작(예: 문체 다듬기). */
export interface EditorSelectionAction {
	readonly id: string;
	readonly label: string;
	readonly icon: ReactNode;
	readonly run: (editor: Editor) => void;
}

/** 슬래시(`/`) 메뉴에 더하는 삽입 동작(예: 초안 쓰기). `range`는 입력한 `/검색어` 자리다. */
export interface EditorInsertAction {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly keywords: readonly string[];
	/** 메뉴 아이콘(lucide 이름이나 컴포넌트). 없으면 퍼즐 아이콘이다. */
	readonly icon?: string | LucideIcon;
	readonly run: (editor: Editor, range: { from: number; to: number }) => void;
}

/**
 * 편집 화면 확장이 더하는 것. 툴바 끝의 요소, 블록 손잡이 옆 동작, 선택 영역 메뉴·슬래시 메뉴의 동작,
 * 편집기가 생기고 사라질 때 받을 함수.
 */
export interface EditorExtensionResult {
	readonly toolbar?: ReactNode;
	/**
	 * 툴바 밖에 한 번만 그리는 요소(대화 상자 등). 툴바 요소는 폭에 따라 다시 그려질 수 있어,
	 * 열려 있는 동안 상태를 지켜야 하는 것은 여기에 둔다.
	 */
	readonly overlay?: ReactNode;
	readonly blockActions?: readonly BlockAction[];
	readonly selectionActions?: readonly EditorSelectionAction[];
	readonly insertActions?: readonly EditorInsertAction[];
	readonly onEditor?: (editor: Editor | null) => void;
}

export type EditorExtension = (context: EditorExtensionContext) => EditorExtensionResult;

/** 인라인 버블 안에 펼치는 입력 칸(링크 입력처럼). */
export interface EditorBubblePanel {
	/** 칸 이름(화면 낭독용). */
	readonly label: string;
	/** `form`은 입력 폼 폭(20rem), `auto`는 내용 폭. 없으면 `form`. */
	readonly size?: "form" | "auto";
	readonly content: ReactNode;
}

/** 인라인 버블 버튼·내용이 받는 값. */
export interface EditorBubbleProps {
	readonly editor: Editor;
	/** 선택이 코드 블록 안인가. */
	readonly inCode: boolean;
	/** 버블 안에 입력 칸을 펼친다. */
	readonly openPanel: (panel: EditorBubblePanel) => void;
	/** 펼친 칸을 닫고 편집기로 초점을 돌린다. */
	readonly closePanel: () => void;
	/** 문서를 바꾸는 동작을 감싼다. 바꾼 뒤에도 버블이 사라지지 않는다(입력으로 보지 않는다). */
	readonly act: (run: () => void) => () => void;
}

/** 커서가 꾸밈 안에 있을 때 버블에 그릴 내용이 받는 값. `mark`는 커서가 걸친 그 꾸밈과 범위다. */
export interface EditorMarkDetailProps extends EditorBubbleProps {
	readonly mark: ActiveInlineMark;
}

/**
 * 글자 꾸밈 확장(블록 확장의 `syntax.kind: "text"` 블록)이 편집기에 더하는 것. 키는 블록 이름이고, 편집기 마크 이름은
 * `cms` + 파스칼 블록 이름이다(`@monti-cms/admin/editor`의 `addedMarkName`). 본체 편집기는 꾸밈 이름을 모르고 이 등록만 그린다.
 */
export interface EditorMarkExtension extends EditorMarkSpec {
	/**
	 * 서식 도구 버튼. `format`은 글자 꾸밈(굵게…) 뒤, `link`는 링크 뒤에 놓는다. `priority`가 있으면 좁을 때 큰 것부터
	 * "더보기" 메뉴(`MenuItems`)로 들어가고, 없으면 숨기지 않는다.
	 */
	readonly toolbar?: {
		readonly group: "format" | "link";
		readonly priority?: number;
		readonly Button: ComponentType<{ readonly editor: Editor }>;
		readonly MenuItems?: ComponentType<{ readonly editor: Editor }>;
	};
	/**
	 * 글자를 골랐을 때 인라인 버블에 더할 버튼. `format`은 글자 꾸밈 뒤, `link`는 링크 묶음에 `order` 순서로 놓는다
	 * (링크는 0, 없으면 1).
	 */
	readonly bubble?: {
		readonly group: "format" | "link";
		readonly order?: number;
		readonly Button: ComponentType<EditorBubbleProps>;
	};
	/** 커서가 이 꾸밈 안에 있을 때 버블에 그릴 내용(설명·수정·해제). 없으면 버블에 나오지 않는다. */
	readonly detail?: ComponentType<EditorMarkDetailProps>;
	/** 슬래시(`/`) 메뉴 항목. 기본 글 서식 항목 다음, 블록 항목 앞에 놓는다. */
	readonly insertActions?: readonly EditorInsertAction[];
}

/**
 * 사이트·플러그인이 관리자 화면에 넣는 컴포넌트. 관리자 레이아웃 안에서 `CmsAdminComponentsProvider`로 준다.
 * 서버 레이아웃은 함수를 브라우저로 넘길 수 없으므로, 클라이언트 컴포넌트가 이 공급자를 그린다.
 * 공급자를 겹치면 바깥 값에 안쪽 값을 더한다(같은 이름은 안쪽이 이긴다).
 */
export interface CmsAdminComponents {
	/**
	 * 코드 펜스 블록(예: `mermaid`·`chart`)의 편집기 미리보기. 키는 펜스 언어이고, 값은 원문(`source`)을 받아 그리는
	 * 컴포넌트를 불러오는 함수다(무거운 렌더러를 미리보기를 열 때만 불러온다). 없으면 원문을 그대로 보인다.
	 */
	readonly fencePreviews?: Readonly<
		Record<string, () => Promise<ComponentType<{ readonly source: string; readonly className?: string }>>>
	>;
	/**
	 * 필드 입력. 컬렉션 정의의 필드 `input`이 이 이름을 가리키면 그린다. 컴포넌트면 기본 입력 대신 그리고
	 * (예: `fields.text({ input: "color" })` + `fieldInputs: { color: ColorInput }`), 조각(`FieldInputParts`)이면 기본 입력을 두고
	 * 안내 문구·이름표 줄 오른쪽만 바꾼다.
	 */
	readonly fieldInputs?: Readonly<Record<string, FieldInputEntry>>;
	/**
	 * 더한 블록(블록 확장·사이트 설정의 `blocks`, `editor.view: "node"`)의 속성·본문 편집 컴포넌트. 키는 블록 이름이다.
	 * 기본 틀 안에 그린다. 없으면 블록 이름과 속성 입력, 본문을 담은 기본 상자로 편집한다.
	 */
	readonly blockEditors?: Readonly<Record<string, ComponentType<CustomBlockEditorProps>>>;
	/**
	 * 더한 블록의 편집 화면 전체(Tiptap NodeView). 키는 블록 이름이다. `blockEditors`보다 먼저 쓴다.
	 * 틀(`NodeViewWrapper`)과 본문 자리(`NodeViewContent`)를 직접 그린다(예: 콜아웃·탭).
	 */
	readonly blockViews?: Readonly<Record<string, ComponentType<NodeViewProps>>>;
	/** 편집 화면 확장(툴바·블록 동작). */
	readonly editorExtensions?: readonly EditorExtension[];
	/**
	 * 글 검사기(맞춤법·문장 등, `defineTextChecker`·`remoteTextChecker`). 편집기가 검사기마다 도구 모음 버튼을 만들고
	 * 결과를 물결 밑줄·결과 창으로 그린다. 그 글의 언어를 검사하는 검사기가 없으면 아무것도 보이지 않는다.
	 */
	readonly textCheckers?: readonly TextChecker[];
	/**
	 * 글자 꾸밈 확장(블록 이름 → 모양·서식 도구·버블·슬래시 메뉴). 블록 확장의 글자 꾸밈(`syntax.kind: "text"`) 블록이 넣는다.
	 * 등록하지 않은 꾸밈은 기본 모양(꾸밈 없는 글자)으로 저장·편집되고 도구가 없다.
	 */
	readonly marks?: Readonly<Record<string, EditorMarkExtension>>;
	/**
	 * 이름으로 고르는 아이콘(lucide 이름 → 컴포넌트). 블록 정의의 `editor.icon`, 플러그인 사이드바 항목의 `icon`,
	 * 컬렉션의 `icon`, 코드 줄 효과의 `icon`이 본체 목록에 없는 이름을 쓰면 여기에 등록한다.
	 */
	readonly icons?: Readonly<Record<string, LucideIcon>>;
	/**
	 * 보기 필드(`fields.view({ view })`)가 그릴 화면(이름 → 컴포넌트). 확장이 등록한다.
	 * 지금 입력 중인 값(`form`)과 저장된 항목(`entry`)을 받는다.
	 */
	readonly fieldViews?: Readonly<Record<string, ComponentType<FieldViewProps>>>;
	/**
	 * 목록 칸(이름 → 컴포넌트). 이름은 목록 컬럼 이름(`list.columns`에 적은 필드·시스템 컬럼 이름)이거나, 그 필드의 `input`
	 * 이름이다(컬럼 이름이 먼저). 등록하지 않은 컬럼은 기본 칸이다: 선택은 선택지 이름표, 글자는 짧은 글, 관계는 이름, 날짜는 날짜.
	 */
	readonly listCells?: Readonly<Record<string, ComponentType<ListCellProps>>>;
}

/** 목록 칸 컴포넌트가 받는 값. */
export interface ListCellProps {
	readonly collection: string;
	/** 컬럼 이름(필드 이름 또는 시스템 컬럼). */
	readonly column: string;
	/** 필드 컬럼이면 그 필드 정의. 시스템 컬럼이면 `undefined`. */
	readonly field?: Field;
	/** 그 줄의 항목. */
	readonly entry: ListEntriesItem;
	/** 필드 컬럼이면 글자로 저장된 값(관계는 `entry.relations`). 값이 없으면 `undefined`. */
	readonly value?: string;
}

/**
 * 기본 입력을 두고 일부만 바꾸는 필드 입력 조각. 모두 지금 입력 중인 값(`FieldInputProps.form`)을 읽을 수 있다.
 */
export interface FieldInputParts {
	/** 입력. 없으면 필드 종류의 기본 입력, `null`이면 입력 줄 없이 이름표 줄만 그린다(켜고 끄기를 `Aside`에 둘 때). */
	readonly Input?: ComponentType<FieldInputProps> | null;
	/** 이름표 줄 오른쪽(글자 수·스위치 등). 필드 옆 동작 버튼보다 앞에 온다. */
	readonly Aside?: ComponentType<FieldInputProps>;
	/** 기본 입력의 안내 문구. `undefined`를 돌려주면 필드의 `placeholder`다. */
	readonly placeholder?: (props: FieldInputProps) => string | undefined;
}

/** 필드 입력 등록 하나: 입력 전체(컴포넌트) 또는 조각. */
export type FieldInputEntry = ComponentType<FieldInputProps> | FieldInputParts;

/** 등록 값이 입력 조각인가(컴포넌트가 아닌 보통 객체). */
export const isFieldInputParts = (entry: FieldInputEntry): entry is FieldInputParts =>
	typeof entry === "object" && entry !== null && !("$$typeof" in entry);

/** 보기 필드 화면이 받는 값. */
export interface FieldViewProps {
	readonly collection: string;
	readonly form: EntryForm;
	readonly entry: EntryData | null;
}

const CmsAdminComponentsContext = createContext<CmsAdminComponents>({});

export function CmsAdminComponentsProvider({
	components,
	children,
}: {
	components: CmsAdminComponents;
	children: ReactNode;
}) {
	const parent = useContext(CmsAdminComponentsContext);
	const value = useMemo<CmsAdminComponents>(
		() => ({
			fencePreviews: { ...parent.fencePreviews, ...components.fencePreviews },
			fieldInputs: { ...parent.fieldInputs, ...components.fieldInputs },
			blockEditors: { ...parent.blockEditors, ...components.blockEditors },
			blockViews: { ...parent.blockViews, ...components.blockViews },
			editorExtensions: [...(parent.editorExtensions ?? []), ...(components.editorExtensions ?? [])],
			textCheckers: [...(parent.textCheckers ?? []), ...(components.textCheckers ?? [])],
			marks: { ...parent.marks, ...components.marks },
			icons: { ...parent.icons, ...components.icons },
			fieldViews: { ...parent.fieldViews, ...components.fieldViews },
			listCells: { ...parent.listCells, ...components.listCells },
		}),
		[parent, components],
	);
	return <CmsAdminComponentsContext.Provider value={value}>{children}</CmsAdminComponentsContext.Provider>;
}

export const useCmsAdminComponents = () => useContext(CmsAdminComponentsContext);

const NO_CHECKERS: readonly TextChecker[] = [];

/** 등록된 편집 화면 확장과 글 검사 화면을 모두 불러 하나로 합친다. */
export function useEditorExtensions(context: EditorExtensionContext): Required<EditorExtensionResult> {
	const { editorExtensions = [], textCheckers = NO_CHECKERS } = useCmsAdminComponents();
	// 확장 목록은 관리자 화면이 떠 있는 동안 같다. 매 렌더 같은 순서로 같은 수의 훅을 부른다.
	const results = [
		...editorExtensions.map((extension) => extension(context)),
		useTextCheckEditor(textCheckers, context),
	];
	const editorCallbacks = results.flatMap((result) => (result.onEditor ? [result.onEditor] : []));
	const callbacksRef = useRef(editorCallbacks);
	callbacksRef.current = editorCallbacks;
	const onEditor = useCallback((editor: Editor | null) => {
		for (const callback of callbacksRef.current) callback(editor);
	}, []);
	return {
		// biome-ignore lint/suspicious/noArrayIndexKey: 확장 목록과 순서는 바뀌지 않는다
		toolbar: results.map((result, index) => <Fragment key={index}>{result.toolbar}</Fragment>),
		// biome-ignore lint/suspicious/noArrayIndexKey: 확장 목록과 순서는 바뀌지 않는다
		overlay: results.map((result, index) => <Fragment key={index}>{result.overlay}</Fragment>),
		blockActions: results.flatMap((result) => result.blockActions ?? []),
		selectionActions: results.flatMap((result) => result.selectionActions ?? []),
		insertActions: results.flatMap((result) => result.insertActions ?? []),
		onEditor,
	};
}
