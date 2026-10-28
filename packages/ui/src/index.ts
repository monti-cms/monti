/**
 * Monti's design system, as screens use it: components take options (variant, tone, size, gap), never `className` or `style`.
 * Tokens are in `styles/` (`theme.css` names, `tokens.css` values). The open versions are in `@monti-cms/ui/internal`.
 */

import { type Closed, close } from "./closed";
import * as open from "./internal";

export const Affix = close(open.Affix);
export const AiAction = close(open.AiAction);
export const AlertDialog = close(open.AlertDialog);
export const AlertDialogAction = close(open.AlertDialogAction);
export const AlertDialogCancel = close(open.AlertDialogCancel);
export const AlertDialogContent = close(open.AlertDialogContent);
export const AlertDialogDescription = close(open.AlertDialogDescription);
export const AlertDialogFooter = close(open.AlertDialogFooter);
export const AlertDialogHeader = close(open.AlertDialogHeader);
export const AlertDialogOverlay = close(open.AlertDialogOverlay);
export const AlertDialogPortal = close(open.AlertDialogPortal);
export const AlertDialogTitle = close(open.AlertDialogTitle);
export const AlertDialogTrigger = close(open.AlertDialogTrigger);
export const Banner = close(open.Banner);
export const Button = close(open.Button);
export const Caret = close(open.Caret);
export const ChangeDot = close(open.ChangeDot);
export const DangerBlock = close(open.DangerBlock);
export const DangerRow = close(open.DangerRow);
export const Chip = close(open.Chip);
export const Count = close(open.Count);
export const Spinner = close(open.Spinner);
export const FilterButton = close(open.FilterButton);
export const FolderTab = close(open.FolderTab);
export const FolderTabs = close(open.FolderTabs);
export const FolderTabsAdd = close(open.FolderTabsAdd);
export const FolderTabsBody = close(open.FolderTabsBody);
export const FolderTabsList = close(open.FolderTabsList);
export const MapRow = close(open.MapRow);
export const ChatInput = close(open.ChatInput);
export const ChatMessage = close(open.ChatMessage);
export const SidePanel = close(open.SidePanel);
export const ToolCallLine = close(open.ToolCallLine);
export type { FormatMark, MontiIcon, PatchLine, ToolCallDetail, ToolCallStatus } from "./internal";

export const CalendarDayButton = close(open.CalendarDayButton);
export const Checkbox = close(open.Checkbox);
export const Collapsible = close(open.Collapsible);
export const CollapsibleContent = close(open.CollapsibleContent);
export const CollapsibleTrigger = close(open.CollapsibleTrigger);
export const ComboboxChip = close(open.ComboboxChip);
export const ComboboxChips = close(open.ComboboxChips);
export const ComboboxChipsInput = close(open.ComboboxChipsInput);
export const ComboboxCollection = close(open.ComboboxCollection);
export const ComboboxContent = close(open.ComboboxContent);
export const ComboboxEmpty = close(open.ComboboxEmpty);
export const ComboboxGroup = close(open.ComboboxGroup);
export const ComboboxInput = close(open.ComboboxInput);
export const ComboboxItem = close(open.ComboboxItem);
export const ComboboxLabel = close(open.ComboboxLabel);
export const ComboboxList = close(open.ComboboxList);
export const ComboboxSeparator = close(open.ComboboxSeparator);
export const ComboboxTrigger = close(open.ComboboxTrigger);
export const ComboboxValue = close(open.ComboboxValue);
export const Command = close(open.Command);
export const CommandFooter = close(open.CommandFooter);
export const CommandEmpty = close(open.CommandEmpty);
export const CommandGroup = close(open.CommandGroup);
export const CommandInput = close(open.CommandInput);
export const CommandItem = close(open.CommandItem);
export const CommandList = close(open.CommandList);
export const CommandSeparator = close(open.CommandSeparator);
export const ContextMenu = close(open.ContextMenu);
export const ContextMenuContent = close(open.ContextMenuContent);
export const ContextMenuGroup = close(open.ContextMenuGroup);
export const ContextMenuItem = close(open.ContextMenuItem);
export const ContextMenuLabel = close(open.ContextMenuLabel);
export const ContextMenuSeparator = close(open.ContextMenuSeparator);
export const ContextMenuSub = close(open.ContextMenuSub);
export const ContextMenuSubContent = close(open.ContextMenuSubContent);
export const ContextMenuSubTrigger = close(open.ContextMenuSubTrigger);
export const ContextMenuTrigger = close(open.ContextMenuTrigger);
export const Dialog = close(open.Dialog);
export const DialogClose = close(open.DialogClose);
export const DialogContent = close(open.DialogContent);
export const DialogDescription = close(open.DialogDescription);
export const DialogFooter = close(open.DialogFooter);
export const DialogHeader = close(open.DialogHeader);
export const DialogOverlay = close(open.DialogOverlay);
export const DialogPortal = close(open.DialogPortal);
export const DialogTitle = close(open.DialogTitle);
export const DialogTrigger = close(open.DialogTrigger);
export const DialogFormFooter = close(open.DialogFormFooter);
export const DropdownMenu = close(open.DropdownMenu);
export const DropdownMenuCheckboxItem = close(open.DropdownMenuCheckboxItem);
export const DropdownMenuContent = close(open.DropdownMenuContent);
export const DropdownMenuGroup = close(open.DropdownMenuGroup);
export const DropdownMenuItem = close(open.DropdownMenuItem);
export const DropdownMenuLabel = close(open.DropdownMenuLabel);
export const DropdownMenuPortal = close(open.DropdownMenuPortal);
export const DropdownMenuScroll = close(open.DropdownMenuScroll);
export const DropdownMenuSearch = close(open.DropdownMenuSearch);
export const DropdownMenuRadioGroup = close(open.DropdownMenuRadioGroup);
export const DropdownMenuRadioItem = close(open.DropdownMenuRadioItem);
export const DropdownMenuSeparator = close(open.DropdownMenuSeparator);
export const DropdownMenuSub = close(open.DropdownMenuSub);
export const DropdownMenuSubContent = close(open.DropdownMenuSubContent);
export const DropdownMenuSubTrigger = close(open.DropdownMenuSubTrigger);
export const DropdownMenuTrigger = close(open.DropdownMenuTrigger);
export const DropArea = close(open.DropArea);
export const FilePreview = close(open.FilePreview);
export const Empty = close(open.Empty);
export const EmptyStep = close(open.EmptyStep);
export const FolderTile = close(open.FolderTile);
export const RenameField = close(open.RenameField);
export const BulkBar = close(open.BulkBar);
export const BulkToolbar = close(open.BulkToolbar);
export const RowActions = close(open.RowActions);
export const ListScroll = close(open.ListScroll);
export const RowCheck = close(open.RowCheck);
export const RowLink = close(open.RowLink);
export const RowTitle = close(open.RowTitle);
export const PageBody = close(open.PageBody);
export const PageColumn = close(open.PageColumn);
export const PageHeader = close(open.PageHeader);
export const PageToolbar = close(open.PageToolbar);
export const PageToolbarEnd = close(open.PageToolbarEnd);
export const ToolbarDivider = close(open.ToolbarDivider);
export const FormField = close(open.FormField);
export const FormFieldDescription = close(open.FormFieldDescription);
export const FormFieldError = close(open.FormFieldError);
export const FormFieldGroup = close(open.FormFieldGroup);
export const FormFieldLabel = close(open.FormFieldLabel);
export const FormFieldLegend = close(open.FormFieldLegend);
export const FormFieldSet = close(open.FormFieldSet);
export const FormFieldTitle = close(open.FormFieldTitle);
export const IconButton = close(open.IconButton);
export const Input = close(open.Input);
export const Label = close(open.Label);
export const UiLabelsProvider = close(open.UiLabelsProvider);
export const ListFooter = close(open.ListFooter);
export const PageSizeMenu = close(open.PageSizeMenu);
export const ListHead = close(open.ListHead);
export const Pagination = close(open.Pagination);
export const PaginationContent = close(open.PaginationContent);
export const PaginationEllipsis = close(open.PaginationEllipsis);
export const PaginationItem = close(open.PaginationItem);
export const PaginationLink = close(open.PaginationLink);
export const PaginationNext = close(open.PaginationNext);
export const PaginationPrevious = close(open.PaginationPrevious);
export const MenuShortcut = close(open.MenuShortcut);
export const MenuTick = close(open.MenuTick);
export const MenuValue = close(open.MenuValue);
export const PickList = close(open.PickList);
export const PickListItem = close(open.PickListItem);
export const Popover = close(open.Popover);
export const PopoverContent = close(open.PopoverContent);
export const PopoverDescription = close(open.PopoverDescription);
export const PopoverHeader = close(open.PopoverHeader);
export const PopoverTitle = close(open.PopoverTitle);
export const PopoverTrigger: Closed<typeof open.PopoverTrigger> = close(open.PopoverTrigger);
export const SelectContent = close(open.SelectContent);
export const SelectGroup = close(open.SelectGroup);
export const SelectItem = close(open.SelectItem);
export const SelectLabel = close(open.SelectLabel);
export const SelectScrollDownButton = close(open.SelectScrollDownButton);
export const SelectScrollUpButton = close(open.SelectScrollUpButton);
export const SelectSeparator = close(open.SelectSeparator);
export const SelectTrigger = close(open.SelectTrigger);
export const SelectValue = close(open.SelectValue);
export const Separator = close(open.Separator);
export const Sheet = close(open.Sheet);
export const SheetClose = close(open.SheetClose);
export const SheetContent = close(open.SheetContent);
export const SheetBody = close(open.SheetBody);
export const SheetFooter = close(open.SheetFooter);
export const SheetHeader = close(open.SheetHeader);
export const SheetTitle = close(open.SheetTitle);
export const SheetTrigger = close(open.SheetTrigger);
export const ResizablePane = close(open.ResizablePane);
export const Sidebar = close(open.Sidebar);
export const SidebarContent = close(open.SidebarContent);
export const SidebarFooter = close(open.SidebarFooter);
export const SidebarGroup = close(open.SidebarGroup);
export const SidebarGroupContent = close(open.SidebarGroupContent);
export const SidebarHeader = close(open.SidebarHeader);
export const SidebarFoot = close(open.SidebarFoot);
export const SidebarInset = close(open.SidebarInset);
export const SidebarMenu = close(open.SidebarMenu);
export const SidebarMenuBadge = close(open.SidebarMenuBadge);
export const SidebarMenuButton = close(open.SidebarMenuButton);
export const SidebarMenuItem = close(open.SidebarMenuItem);
export const SidebarMenuSub = close(open.SidebarMenuSub);
export const SidebarMenuSubButton = close(open.SidebarMenuSubButton);
export const SidebarProvider = close(open.SidebarProvider);
export const SidebarRailToggle = close(open.SidebarRailToggle);
export const SidebarScreenMode = close(open.SidebarScreenMode);
export const SidebarTrigger = close(open.SidebarTrigger);
/** An icon like the Carbon ones, so it is not closed: it goes where an `icon` goes (`<Icon icon={Spark}>`, a panel's or a menu item's icon). */
export const Spark = open.Spark;
export const StatusBarList = close(open.StatusBarList);
export const TodoDone = close(open.TodoDone);
export const TodoItem = close(open.TodoItem);
export const TrashRowDate = close(open.TrashRowDate);
export const TrashRowTitle = close(open.TrashRowTitle);
export const SplitButton = close(open.SplitButton);
export const Stack = close(open.Stack);
export const Inline = close(open.Inline);
export const Box = close(open.Box);
export const ChatError = close(open.ChatError);
export const CurrentProposal = close(open.CurrentProposal);
export const Del = close(open.Del);
export const Fill = close(open.Fill);
export const Highlight = close(open.Highlight);
export const Ins = close(open.Ins);
export const MemoCard = close(open.MemoCard);
export const MemoDiff = close(open.MemoDiff);
export const MemoMessage = close(open.MemoMessage);
export const MemoThread = close(open.MemoThread);
export const ProposalBubble = close(open.ProposalBubble);
export const ProposalCard = close(open.ProposalCard);
export const ProposalItem = close(open.ProposalItem);
export const Suggest = close(open.Suggest);
export const Block = close(open.Block);
export const BlockBar = close(open.BlockBar);
export const BlockBarButton = close(open.BlockBarButton);
export const BlockBarSeparator = close(open.BlockBarSeparator);
export const BlockHandle = close(open.BlockHandle);
export const ChangeActions = close(open.ChangeActions);
export const ChangeGroup = close(open.ChangeGroup);
export const ChangeLabel = close(open.ChangeLabel);
export const ChangeLine = close(open.ChangeLine);
export const ChangeLines = close(open.ChangeLines);
export const ChangeNote = close(open.ChangeNote);
export const FieldRow = close(open.FieldRow);
export const FieldTree = close(open.FieldTree);
export const FormatButton = close(open.FormatButton);
export const FormatBar = close(open.FormatBar);
export const FormatBarButton = close(open.FormatBarButton);
export const FormatBarRequest = close(open.FormatBarRequest);
export const FormatBarSeparator = close(open.FormatBarSeparator);
export const Marker = close(open.Marker);
export const Patch = close(open.Patch);
export const ResizeCorner = close(open.ResizeCorner);
export const Section = close(open.Section);
export const Untranslated = close(open.Untranslated);
export const CodeBlock = close(open.CodeBlock);
export const HeadingIcon = close(open.HeadingIcon);
/** The heading glyphs by level (2, 3, 4), as icon components: they go where an `icon` goes (a slash menu item, a toolbar entry). */
export const headingIcons = open.headingIcons;
export const Icon = close(open.Icon);
export const Image = close(open.Image);
export const List = close(open.List);
export const ListItem = close(open.ListItem);
export const Progress = close(open.Progress);
export const Option = close(open.Option);
export const RadioGroup = close(open.RadioGroup);
export const RadioItem = close(open.RadioItem);
export const TagInput = close(open.TagInput);
export const Tile = close(open.Tile);
export const Grid = close(open.Grid);
export const StatusBar = close(open.StatusBar);
export const StatusBarAnnouncer = close(open.StatusBarAnnouncer);
export const StatusBarCell = close(open.StatusBarCell);
export const StatusBarPluginCell = close(open.StatusBarPluginCell);
export const StatusBarSpacer = close(open.StatusBarSpacer);
export const EntryStatus = close(open.EntryStatus);
export const Switch = close(open.Switch);
export const Table = close(open.Table);
export const TableBody = close(open.TableBody);
export const TableCell = close(open.TableCell);
export const TableHead = close(open.TableHead);
export const TableHeader = close(open.TableHeader);
export const TableRow = close(open.TableRow);
export const TabLink = close(open.TabLink);
export const TabLinks = close(open.TabLinks);
export const Tabs = close(open.Tabs);
export const TabsContent = close(open.TabsContent);
export const TabsList = close(open.TabsList);
export const TabsTrigger = close(open.TabsTrigger);
export const Heading = close(open.Heading);
export const Text = close(open.Text);
export const DescriptionList = close(open.DescriptionList);
export const DotNote = close(open.DotNote);
export const DescriptionItem = close(open.DescriptionItem);
export const TextButton = close(open.TextButton);
export const Textarea = close(open.Textarea);
export const Tooltip = close(open.Tooltip);
export const TooltipContent = close(open.TooltipContent);
export const TooltipProvider = close(open.TooltipProvider);
export const TooltipTrigger = close(open.TooltipTrigger);

export type { Closed } from "./closed";
export type {
	Background,
	EntryStatusKind,
	LayoutProps,
	ListHeadAdd,
	ListHeadColumn,
	SearchTarget,
	SegmentedOption,
	SelectAll,
	SelectAllState,
	Spacing,
	StackProps,
	UiLabels,
} from "./internal";
/** Roots that infer their value type: closing them would erase it, and they render no box of their own to style. */
export {
	Calendar,
	Combobox,
	cn,
	DEFAULT_UI_LABELS,
	SearchBox,
	SearchToggle,
	Segmented,
	Select,
	stackVariants,
	Toaster,
	textVariants,
	toast,
	useComboboxAnchor,
	useIsMobile,
	useSidebar,
	useUiLabels,
} from "./internal";
