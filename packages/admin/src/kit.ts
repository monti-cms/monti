/**
 * Extension kit. Exports in one place the parts and helpers an extension (plugin) uses to build screens, buttons and dialogs
 * that look like the admin UI. Internal admin file paths (`ui/*`, `screens/*`) are not public.
 */

export { apiKeysKeys } from "./api/api-keys";
export { commonMessages } from "./lib/common.messages";
export { useHydratedQuery } from "./lib/hooks/use-hydrated-query";
export { isComposingKey } from "./lib/keyboard";
export { cn } from "./lib/utils/cn";
export { type ApiKeyChoice, ApiKeyField, choiceReady } from "./screens/api-keys/api-key-field";
export type { EntryData, EntryForm } from "./screens/entries/entry-form";
export { EMPTY_FORM } from "./screens/entries/entry-form";
export { MediaThumbnail } from "./screens/entries/media-image-input";
export { PageActions } from "./screens/shared/admin-shell";
export { useConfirm } from "./screens/shared/confirm-dialog";
export { EditorFooter } from "./screens/shared/editor-footer";
export { EmptyState } from "./screens/shared/empty-state";
export { formatAgo } from "./screens/shared/format-date";
export { DETAIL_PANE_FRAME } from "./screens/shared/layout";
export { LoadErrorAlert } from "./screens/shared/load-error-alert";
export { ListPane, ListRow, MasterDetail } from "./screens/shared/master-detail";
export {
	type EditorStatus,
	type EditorTextIssue,
	type EditorTranslation,
	type StatusBarContextValue,
	StatusBarItem,
	type StatusBarItemProps,
	type StatusBarScreen,
	type StatusItemDefinition,
	StatusPopoverHeader,
	StatusPopoverRow,
	useStatusBarContext,
} from "./screens/shared/status-bar";
export { useDebounced } from "./screens/shared/use-debounced";
export { useDraftEditor } from "./screens/shared/use-draft-editor";
export { useUnsavedGuard } from "./screens/shared/use-unsaved-guard";
export { Alert, AlertDescription, AlertTitle } from "./ui/alert";
export { Badge } from "./ui/badge";
export { Button } from "./ui/button";
export { Panel } from "./ui/card";
export { Checkbox } from "./ui/checkbox";
export { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "./ui/combobox";
export { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
export {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
export { ErrorNoticeView } from "./ui/error-notice";
export { FormField, FormFieldError, FormFieldGroup, FormFieldLabel, FormFieldTitle } from "./ui/field";
export { IconButton } from "./ui/icon-button";
export { Input } from "./ui/input";
export { Label } from "./ui/label";
export { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
export { Skeleton } from "./ui/skeleton";
export { Spinner } from "./ui/spinner";
export { Switch } from "./ui/switch";
export { PageTabs, Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
export { Textarea } from "./ui/textarea";
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
