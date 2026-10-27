/**
 * Monti's design system, as screens use it: components take options (variant, tone, size, gap), never `className` or `style`.
 * Tokens are in `styles/` (`theme.css` names, `tokens.css` values). The open versions are in `@monti-cms/ui/internal`.
 */

import { type Closed, close } from "./closed";
import * as open from "./internal";

export const Affix = close(open.Affix);
export const AiAction = close(open.AiAction);
export const Alert = close(open.Alert);
export const AlertDescription = close(open.AlertDescription);
export const AlertTitle = close(open.AlertTitle);
export const AlertDialog = close(open.AlertDialog);
export const AlertDialogAction = close(open.AlertDialogAction);
export const AlertDialogCancel = close(open.AlertDialogCancel);
export const AlertDialogContent = close(open.AlertDialogContent);
export const AlertDialogDescription = close(open.AlertDialogDescription);
export const AlertDialogFooter = close(open.AlertDialogFooter);
export const AlertDialogHeader = close(open.AlertDialogHeader);
export const AlertDialogMedia = close(open.AlertDialogMedia);
export const AlertDialogOverlay = close(open.AlertDialogOverlay);
export const AlertDialogPortal = close(open.AlertDialogPortal);
export const AlertDialogTitle = close(open.AlertDialogTitle);
export const AlertDialogTrigger = close(open.AlertDialogTrigger);
export const Badge = close(open.Badge);
export const Button = close(open.Button);
export const Caret = close(open.Caret);
export const ChangeDot = close(open.ChangeDot);
export const Chip = close(open.Chip);
export const Count = close(open.Count);
export const FilterButton = close(open.FilterButton);
export const FolderTab = close(open.FolderTab);
export const FolderTabs = close(open.FolderTabs);
export const FolderTabsAdd = close(open.FolderTabsAdd);
export const FolderTabsBody = close(open.FolderTabsBody);
export const FolderTabsList = close(open.FolderTabsList);
export const MapRow = close(open.MapRow);
export const ChatInput = close(open.ChatInput);
export const ChatMessage = close(open.ChatMessage);
export const SidePanelFrame = close(open.SidePanelFrame);
export const ToolCallLine = close(open.ToolCallLine);
export type { ToolCallDetail, ToolCallStatus } from "./internal";

export const CalendarDayButton = close(open.CalendarDayButton);
export const Card = close(open.Card);
export const CardAction = close(open.CardAction);
export const CardContent = close(open.CardContent);
export const CardDescription = close(open.CardDescription);
export const CardFooter = close(open.CardFooter);
export const CardHeader = close(open.CardHeader);
export const CardTitle = close(open.CardTitle);
export const Panel = close(open.Panel);
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
export const CommandDialog = close(open.CommandDialog);
export const CommandEmpty = close(open.CommandEmpty);
export const CommandGroup = close(open.CommandGroup);
export const CommandInput = close(open.CommandInput);
export const CommandItem = close(open.CommandItem);
export const CommandList = close(open.CommandList);
export const CommandSeparator = close(open.CommandSeparator);
export const CommandShortcut = close(open.CommandShortcut);
export const ContextMenu = close(open.ContextMenu);
export const ContextMenuCheckboxItem = close(open.ContextMenuCheckboxItem);
export const ContextMenuContent = close(open.ContextMenuContent);
export const ContextMenuGroup = close(open.ContextMenuGroup);
export const ContextMenuItem = close(open.ContextMenuItem);
export const ContextMenuLabel = close(open.ContextMenuLabel);
export const ContextMenuPortal = close(open.ContextMenuPortal);
export const ContextMenuRadioGroup = close(open.ContextMenuRadioGroup);
export const ContextMenuRadioItem = close(open.ContextMenuRadioItem);
export const ContextMenuSeparator = close(open.ContextMenuSeparator);
export const ContextMenuShortcut = close(open.ContextMenuShortcut);
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
export const DropdownMenuRadioGroup = close(open.DropdownMenuRadioGroup);
export const DropdownMenuRadioItem = close(open.DropdownMenuRadioItem);
export const DropdownMenuSeparator = close(open.DropdownMenuSeparator);
export const DropdownMenuShortcut = close(open.DropdownMenuShortcut);
export const DropdownMenuSub = close(open.DropdownMenuSub);
export const DropdownMenuSubContent = close(open.DropdownMenuSubContent);
export const DropdownMenuSubTrigger = close(open.DropdownMenuSubTrigger);
export const DropdownMenuTrigger = close(open.DropdownMenuTrigger);
export const Empty = close(open.Empty);
export const EmptyContent = close(open.EmptyContent);
export const EmptyDescription = close(open.EmptyDescription);
export const EmptyHeader = close(open.EmptyHeader);
export const EmptyMedia = close(open.EmptyMedia);
export const EmptyTitle = close(open.EmptyTitle);
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
export const Pagination = close(open.Pagination);
export const PaginationContent = close(open.PaginationContent);
export const PaginationEllipsis = close(open.PaginationEllipsis);
export const PaginationItem = close(open.PaginationItem);
export const PaginationLink = close(open.PaginationLink);
export const PaginationNext = close(open.PaginationNext);
export const PaginationPrevious = close(open.PaginationPrevious);
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
export const SheetDescription = close(open.SheetDescription);
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
export const SidebarGroupLabel = close(open.SidebarGroupLabel);
export const SidebarHeader = close(open.SidebarHeader);
export const SidebarInset = close(open.SidebarInset);
export const SidebarMenu = close(open.SidebarMenu);
export const SidebarMenuBadge = close(open.SidebarMenuBadge);
export const SidebarMenuButton = close(open.SidebarMenuButton);
export const SidebarMenuItem = close(open.SidebarMenuItem);
export const SidebarProvider = close(open.SidebarProvider);
export const SidebarSeparator = close(open.SidebarSeparator);
export const SidebarTrigger = close(open.SidebarTrigger);
export const Skeleton = close(open.Skeleton);
export const Spark = close(open.Spark);
export const Spinner = close(open.Spinner);
export const SplitButton = close(open.SplitButton);
export const Stack = close(open.Stack);
export const Inline = close(open.Inline);
export const Box = close(open.Box);
export const CodeBlock = close(open.CodeBlock);
export const DiffMark = close(open.DiffMark);
export const DiffView = close(open.DiffView);
export const Icon = close(open.Icon);
export const Image = close(open.Image);
export const List = close(open.List);
export const ListItem = close(open.ListItem);
export const Progress = close(open.Progress);
export const Option = close(open.Option);
export const RadioGroup = close(open.RadioGroup);
export const RadioItem = close(open.RadioItem);
export const ChoiceCard = close(open.ChoiceCard);
export const TagInput = close(open.TagInput);
export const Tile = close(open.Tile);
export const Grid = close(open.Grid);
export const StatusIndicator = close(open.StatusIndicator);
export const Switch = close(open.Switch);
export const Table = close(open.Table);
export const TableBody = close(open.TableBody);
export const TableCaption = close(open.TableCaption);
export const TableCell = close(open.TableCell);
export const TableFooter = close(open.TableFooter);
export const TableHead = close(open.TableHead);
export const TableHeader = close(open.TableHeader);
export const TableRow = close(open.TableRow);
export const Tabs = close(open.Tabs);
export const TabsContent = close(open.TabsContent);
export const TabsList = close(open.TabsList);
export const TabsTrigger = close(open.TabsTrigger);
export const Heading = close(open.Heading);
export const Text = close(open.Text);
export const DescriptionList = close(open.DescriptionList);
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
	LayoutProps,
	SearchTarget,
	SegmentedOption,
	Spacing,
	StackProps,
	StatusShape,
	StatusTone,
	UiLabels,
} from "./internal";
/** Roots that infer their value type: closing them would erase it, and they render no box of their own to style. */
export {
	alertVariants,
	badgeVariants,
	Calendar,
	Combobox,
	cn,
	DEFAULT_UI_LABELS,
	SearchBox,
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
