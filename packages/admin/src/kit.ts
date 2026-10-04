/**
 * Extension kit. Exports in one place the parts and helpers an extension (plugin) uses to build screens, buttons and dialogs
 * that look like the admin UI. Internal admin file paths (`ui/*`, `screens/*`) are not public.
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
