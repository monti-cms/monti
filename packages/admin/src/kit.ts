/**
 * 확장용 묶음(M16-8). 확장(플러그인)이 관리자 화면과 같은 모양의 화면·버튼·대화상자를 만들 때 쓰는 부품과 도우미를
 * 한곳에서 내보낸다. 관리자 내부 파일 경로(`ui/*`·`screens/*`)는 공개하지 않는다.
 */

export { cn } from "./lib/utils/cn";
export type { EntryData, EntryForm, FormValue } from "./screens/entries/entry-form";
export { EMPTY_FORM, formList, formText, metadataFromForm } from "./screens/entries/entry-form";
export { AdminShell, useAdminNav } from "./screens/shared/admin-shell";
export { NamedIcon, useIconByName } from "./screens/shared/collection-icon";
export type { ConfirmRequest } from "./screens/shared/confirm-dialog";
export { ConfirmDialog, DISCARD_CONFIRM, useConfirm } from "./screens/shared/confirm-dialog";
export { useDebounced } from "./screens/shared/use-debounced";
export * from "./ui/alert";
export * from "./ui/alert-dialog";
export * from "./ui/badge";
export * from "./ui/button";
export * from "./ui/calendar";
export * from "./ui/card";
export * from "./ui/checkbox";
export * from "./ui/collapsible";
export * from "./ui/combobox";
export * from "./ui/command";
export * from "./ui/context-menu";
export * from "./ui/dialog";
export * from "./ui/dropdown-menu";
export * from "./ui/empty";
export * from "./ui/field";
export * from "./ui/icon-button";
export * from "./ui/input";
export * from "./ui/input-group";
export * from "./ui/label";
export * from "./ui/pagination";
export * from "./ui/popover";
export * from "./ui/select";
export * from "./ui/separator";
export * from "./ui/sheet";
export * from "./ui/skeleton";
export * from "./ui/spinner";
export * from "./ui/switch";
export * from "./ui/table";
export * from "./ui/tabs";
export * from "./ui/textarea";
export * from "./ui/toggle";
export * from "./ui/toggle-group";
export * from "./ui/tooltip";
