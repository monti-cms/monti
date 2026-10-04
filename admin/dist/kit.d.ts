/**
 * Extension kit. Exports in one place the parts and helpers an extension (plugin) uses to build screens, buttons and dialogs
 * that look like the admin UI. Internal admin file paths (`ui/*`, `screens/*`) are not public.
 */
export { cn } from "./lib/utils/cn.js";
export type { EntryData, EntryForm, FormValue } from "./screens/entries/entry-form.js";
export { EMPTY_FORM, formList, formText, metadataFromForm } from "./screens/entries/entry-form.js";
export { AdminShell, useAdminNav } from "./screens/shared/admin-shell.js";
export { NamedIcon, useIconByName } from "./screens/shared/collection-icon.js";
export type { ConfirmRequest } from "./screens/shared/confirm-dialog.js";
export { ConfirmDialog, DISCARD_CONFIRM, useConfirm } from "./screens/shared/confirm-dialog.js";
export { useDebounced } from "./screens/shared/use-debounced.js";
export * from "./ui/alert.js";
export * from "./ui/alert-dialog.js";
export * from "./ui/badge.js";
export * from "./ui/button.js";
export * from "./ui/calendar.js";
export * from "./ui/card.js";
export * from "./ui/checkbox.js";
export * from "./ui/collapsible.js";
export * from "./ui/combobox.js";
export * from "./ui/command.js";
export * from "./ui/context-menu.js";
export * from "./ui/dialog.js";
export * from "./ui/dropdown-menu.js";
export * from "./ui/empty.js";
export * from "./ui/field.js";
export * from "./ui/icon-button.js";
export * from "./ui/input.js";
export * from "./ui/input-group.js";
export * from "./ui/label.js";
export * from "./ui/pagination.js";
export * from "./ui/popover.js";
export * from "./ui/select.js";
export * from "./ui/separator.js";
export * from "./ui/sheet.js";
export * from "./ui/skeleton.js";
export * from "./ui/spinner.js";
export * from "./ui/switch.js";
export * from "./ui/table.js";
export * from "./ui/tabs.js";
export * from "./ui/textarea.js";
export * from "./ui/toggle.js";
export * from "./ui/toggle-group.js";
export * from "./ui/tooltip.js";
