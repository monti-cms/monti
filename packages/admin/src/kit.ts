/**
 * Extension kit. Exports in one place the parts and helpers an extension (plugin) uses to build screens, buttons and dialogs
 * that look like the admin UI. Internal admin file paths (`ui/*`, `screens/*`) are not public.
 */

export {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Banner,
	Box,
	Button,
	ChatInput,
	ChatMessage,
	Checkbox,
	ChoiceCard,
	CodeBlock,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	cn,
	Del,
	DescriptionItem,
	DescriptionList,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	FormField,
	FormFieldDescription,
	FormFieldError,
	FormFieldGroup,
	FormFieldLabel,
	FormFieldTitle,
	Grid,
	Heading,
	Icon,
	IconButton,
	Image,
	Inline,
	Input,
	Ins,
	Label,
	List,
	ListItem,
	Patch,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Progress,
	RadioGroup,
	RadioItem,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SidePanelFrame,
	Skeleton,
	Spark,
	Spinner,
	SplitButton,
	Stack,
	Switch,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	TagInput,
	Text,
	Textarea,
	TextButton,
	Tile,
	type ToolCallDetail,
	ToolCallLine,
	type ToolCallStatus,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	toast,
} from "@monti-cms/ui";
export { apiKeysKeys } from "./api/api-keys";
export { commonMessages } from "./lib/common.messages";
export { useHydratedQuery } from "./lib/hooks/use-hydrated-query";
export { booleanCodec, usePreference } from "./lib/hooks/use-preference";
export { isComposingKey } from "./lib/keyboard";
export { type ApiKeyChoice, ApiKeyField, choiceReady } from "./screens/api-keys/api-key-field";
export type { EntryData, EntryForm } from "./screens/entries/entry-form";
export { EMPTY_FORM } from "./screens/entries/entry-form";
export { MediaThumbnail } from "./screens/entries/media-image-input";
export { PageActions } from "./screens/shared/admin-shell";
export { useConfirm } from "./screens/shared/confirm-dialog";
export { EditorFooter } from "./screens/shared/editor-footer";
export { EmptyState } from "./screens/shared/empty-state";
export { formatAgo } from "./screens/shared/format-date";
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
export { ErrorNoticeView } from "./ui/error-notice";
