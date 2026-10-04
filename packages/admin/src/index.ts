/**
 * 관리자 화면의 브라우저 쪽 진입점. 사이트·플러그인이 관리자 화면에 컴포넌트(코드 펜스 미리보기·필드 입력·편집 화면 확장)를
 * 넣을 때(`CmsAdminComponentsProvider`) 쓴다.
 */
export {
	type CmsAdminComponents,
	CmsAdminComponentsProvider,
	type EditorExtension,
	type EditorExtensionContext,
	type EditorExtensionResult,
	type EditorInsertAction,
	type EditorSelectionAction,
	type FieldInputEntry,
	type FieldInputParts,
	type FieldViewProps,
	type ListCellProps,
	useCmsAdminComponents,
} from "./admin-components";
export type { CustomBlockEditorProps } from "./editor/blocks/added/view";
export type { FieldContext, FieldInputProps } from "./screens/entries/field-inputs";
