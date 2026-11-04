import * as React from "react";
import { Affix } from "../affix";
import { Banner as BannerPart } from "../banner";
import { Block, BlockHandle } from "../block-handle";
import { Box as BoxPart } from "../box";
import { Button } from "../button";
import { Caret } from "../caret";
import { ChangeGroup, ChangeLine, ChangeLines, ChangeNote } from "../change";
import { ChangeDot } from "../change-dot";
import { ChangesBar } from "../changes-group";
import { ChatInput } from "../chat-input";
import { ChatEntryLink, ChatEntryList, ChatMessage } from "../chat-message";
import { ChatAnswer, ChatThread, ToolCallLines } from "../chat-thread";
import { Checkbox } from "../checkbox";
import { cn } from "../cn";
import {
	Compare,
	CompareBody,
	CompareHeading,
	CompareParagraph,
	CompareProperty,
	CompareRow,
	CompareRows,
	CompareShared,
	CompareSide,
	CompareText,
	CompareTitle,
} from "../compare";
import { Count } from "../count";
import { DangerBlock, DangerRow } from "../danger-block";
import { DocCallout, DocCode, DocTable } from "../doc-blocks";
import { DragHandle } from "../drag-handle";
import { DropArea } from "../drop-area";
import { EditorHeader, EditorTitleRule } from "../editor-header";
import { Empty, EmptyStep as EmptyStepPart, EmptySteps } from "../empty";
import { EntryStatus } from "../entry-status";
import { FormField, FormFieldError, FormFieldLabel as FormFieldLabelPart, FormFieldWas } from "../field";
import { FieldRow, FieldTree as FieldTreePart } from "../field-tree";
import { FilePreview } from "../file-preview";
import { FilterButton } from "../filter-button";
import { FloatingBar } from "../floating-bar";
import { FolderTab, FolderTabs, FolderTabsAdd, FolderTabsBody, FolderTabsList } from "../folder-tabs";
import { FormatBarRequest, FormatButton, type FormatMark } from "../format-bar";
import { Grid } from "../grid";
import { IconButton } from "../icon-button";
import { FolderParent, type IconName, iconsByName } from "../icons";
import { Image as ImagePart } from "../image";
import { Input as InputPart } from "../input";
import { LanguageRow, LanguageSource } from "../language-row";
import { ListHead as ListHeadPart } from "../list-head";
import { ListSection as ListSectionPart, ListSectionRow } from "../list-section";
import { LockMark } from "../lock-mark";
import { Marker, Untranslated } from "../marker";
import { MediaPicker } from "../media-picker";
import { MemoCard, MemoMessage, MemoThread } from "../memo-card";
import { MENU_CARD, MENU_ITEM, MENU_LABEL, MENU_SEPARATOR, MENU_SUB_MARK, MenuShortcut } from "../menu-parts";
import { NavLink } from "../nav-link";
import { Option } from "../option";
import { PageColumn, PageHeader, PageToolbar, PageToolbarEnd } from "../page-header";
import {
	ListFooter,
	PageSizeMenu,
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "../pagination";
import { PickList, PickListItem } from "../pick-list";
import { PropertyGroup, PropertyPanel } from "../property-list";
import { ProposalBubble, ProposalBubbleDock } from "../proposal-bubble";
import { ProposalActions, ProposalCard, ProposalEntry } from "../proposal-card";
import { Del, Ins, PROPOSAL_MARK_CLASSES } from "../proposal-marks";
import { RadioGroup, RadioItem } from "../radio-group";
import { RailAction, RailLayout } from "../rail-layout";
import { ReadValue as ReadValuePart } from "../read-value";
import {
	ReviewCompare,
	ReviewCompareHead,
	ReviewGroup,
	ReviewItem,
	ReviewLine,
	ReviewMore,
	ReviewQuote,
} from "../review";
import { SearchToggle as SearchTogglePart } from "../search-box";
import { Section } from "../section";
import { Segmented } from "../segmented";
import { Select, SelectTrigger, SelectValue } from "../select";
import { Separator } from "../separator";
import {
	SheetBody as SheetBodyPart,
	SheetContent,
	SheetFooter,
	SheetHeader,
	Sheet as SheetRoot,
	SheetSplit as SheetSplitPart,
	SheetSummary as SheetSummaryPart,
	SheetTitle,
} from "../sheet";
import { SidePanel } from "../side-panel";
import {
	SidebarContent,
	SidebarFooter,
	SidebarFoot as SidebarFootPart,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	Sidebar as SidebarPart,
	SidebarProvider,
	SidebarRailToggle,
	SidebarScreenMode as SidebarScreenModePart,
	SidebarSiteName,
} from "../sidebar";
import { SplitButton } from "../split-button";
import { Inline, Stack as StackPart } from "../stack";
import { StatusBar, StatusBarCell, StatusBarSpacer } from "../status-bar";
import { StatusBarList } from "../status-bar-list";
import { Suggest, SuggestLabel, SuggestList } from "../suggest";
import { Switch } from "../switch";
import {
	ListScroll,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowTitle,
	Table,
	TableBody,
	TableCell,
	TableRow,
} from "../table";
import { TabLink, TabLinks, TabsList, Tabs as TabsRoot, TabsTrigger } from "../tabs";
import { TagInput } from "../tag-input";
import { Heading, Text } from "../text";
import { TextButton } from "../text-button";
import { Textarea as TextareaPart } from "../textarea";
import { FolderTile, Tile } from "../tile";
import { TodoDone, TodoItem } from "../todo-item";
import { ToolCallLine } from "../tool-call-line";
import { TrashRowDate, TrashRowTitle } from "../trash-row";

/** An icon by its Carbon name in the design system's icon list (`iconsByName`), in a part that takes its icon as children (a button, an icon button). */
function Icon({ name }: { name: IconName }) {
	const Glyph = iconsByName[name];
	return <Glyph aria-hidden />;
}

/** A form that posts to an address: its `action` is the name of a thing the screen does. A button in it sends it (`ScreenSpec` makes it the submit). */
function Form({ action, className, children }: { action?: string; className?: string; children?: React.ReactNode }) {
	return (
		<form method="post" action={action} className={className}>
			{children}
		</form>
	);
}

/** A field's label. `for` names the field it labels by its element in the spec (`@emailInput`); `ScreenSpec` gives both the real ids. */
function FormFieldLabel({
	for: field,
	className,
	children,
}: {
	for?: string;
	className?: string;
	children?: React.ReactNode;
}) {
	return (
		<FormFieldLabelPart htmlFor={field} className={className}>
			{children}
		</FormFieldLabelPart>
	);
}

/**
 * A one-line field. `type` is the kind of words it takes (the dots of a password); what it holds is the element's `bind`, which `ScreenSpec` turns into
 * its name and its first value, and its id comes from the spec too: no HTML attribute is written in a spec.
 */
function Input({
	type = "text",
	id,
	name,
	value,
	placeholder,
	size,
	width,
	mono,
	autofill,
	required,
	invalid,
	className,
}: {
	type?: "text" | "email" | "password";
	/** What the browser may fill in: the account's name, its password, or a new password it offers to keep. */
	autofill?: "username" | "current-password" | "new-password";
	/** The form is not sent while it is empty. */
	required?: boolean;
	/** What it holds was refused: the underline turns danger. */
	invalid?: boolean;
	id?: string;
	name?: string;
	/** The value it starts with, from its `bind`. */
	value?: string;
	placeholder?: string;
	size?: "sm" | "default";
	width?: "full" | "short" | "number" | "fit";
	mono?: boolean;
	className?: string;
}) {
	return (
		<InputPart
			type={type}
			id={id}
			name={name}
			defaultValue={value}
			placeholder={placeholder}
			size={size}
			width={width}
			mono={mono}
			autoComplete={autofill}
			required={required}
			aria-invalid={invalid || undefined}
			className={className}
		/>
	);
}

/** The page's search button and box. What it holds is its `bind`; with nothing bound it starts empty, as the button. */
function SearchToggle({
	value,
	...props
}: Omit<React.ComponentProps<typeof SearchTogglePart>, "value"> & { value?: string }) {
	return <SearchTogglePart value={value ?? ""} {...props} />;
}

/** A picture from the data (a login method's icon). It stands beside words that say what it is, so it has no words of its own. */
function Image({
	src,
	size,
	radius,
	fit,
	className,
}: Pick<React.ComponentProps<typeof ImagePart>, "src" | "size" | "radius" | "fit" | "className">) {
	return <ImagePart src={src} alt="" size={size} radius={radius} fit={fit} className={className} />;
}

/**
 * Children in a column or a row, with no space of its own: the space is the spec's `Spacing` items, which `ScreenSpec` turns into this element's gap and
 * padding classes or its children's margin classes.
 */
function Stack({
	direction = "column",
	align,
	justify,
	grow,
	wrap,
	width,
	maxWidth,
	minWidth,
	minHeight,
	className,
	children,
}: {
	direction?: "column" | "row";
	align?: "start" | "center" | "end" | "baseline" | "stretch";
	justify?: "start" | "center" | "end" | "between";
	/** Takes the room its parent leaves on the parent's axis (the region that pushes a line to the bottom of the page). */
	grow?: boolean;
	/** A row whose children go on to the next line when they do not fit (fields side by side on a wide page). */
	wrap?: boolean;
	/** The region's width in px, decided by the screen (a side column). */
	width?: number;
	/** The region's widest in px, decided by the screen (a form of 360). */
	maxWidth?: number;
	/** The region's narrowest in px, decided by the screen. */
	minWidth?: number;
	/** `screen`: at least as tall as the window (a page that stands alone). */
	minHeight?: "screen";
	className?: string;
	children?: React.ReactNode;
}) {
	const sized = maxWidth !== undefined || minWidth !== undefined;
	return (
		<StackPart
			direction={direction}
			align={align}
			justify={justify}
			grow={grow}
			wrap={wrap}
			gap={0}
			minHeight={minHeight}
			width={sized && width === undefined ? "full" : undefined}
			className={className}
			style={width === undefined && !sized ? undefined : { width, maxWidth, minWidth }}
		>
			{children}
		</StackPart>
	);
}

/**
 * The sidebar as a board draws it: flat, a header, a list of rows, a bottom list, a foot. The design system's sidebar nests more layers (a provider, a
 * group, a menu, a menu item around each row); these entries put them in, so a board, a spec and the parts line up one to one.
 */
function Sidebar({
	rail,
	label,
	className,
	children,
}: {
	rail?: boolean;
	label?: string;
	className?: string;
	children?: React.ReactNode;
}) {
	return (
		// As in the app's frame, the sidebar keeps to the window while a long page scrolls beside it.
		<SidebarProvider rail={rail} className={cn("sticky top-0 h-svh self-start", className)}>
			<SidebarPart label={label ?? ""}>{children}</SidebarPart>
		</SidebarProvider>
	);
}

/** The foot of the sidebar's bottom list: the screen mode. */
function SidebarFoot({ children }: { children?: React.ReactNode }) {
	return <SidebarFootPart>{children}</SidebarFootPart>;
}

/** A list of rows: `top`, the content that takes the height (its group and menu), or `bottom`, the footer's menu with the foot under it. */
function SidebarNav({ place = "top", children }: { place?: "top" | "bottom"; children?: React.ReactNode }) {
	const all = React.Children.toArray(children);
	const isFoot = (child: React.ReactNode) => React.isValidElement(child) && child.type === SidebarFoot;
	const rows = all.filter((child) => !isFoot(child));
	if (place === "bottom") {
		return (
			<SidebarFooter>
				<SidebarMenu>{rows}</SidebarMenu>
				{all.filter(isFoot)}
			</SidebarFooter>
		);
	}
	return (
		<SidebarContent>
			<SidebarGroup>
				<SidebarGroupContent>
					<SidebarMenu>{rows}</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>
	);
}

/** One row: its icon, its name and its count as children; `active`, the open one. */
function SidebarItem({ active, children }: { active?: boolean; children?: React.ReactNode }) {
	// The row's name goes in a span, as the design system's row takes it: folded to a rail, the row hides it and keeps the icon.
	const parts = React.Children.toArray(children).map((child, index) =>
		React.isValidElement(child) ? child : <span key={index}>{child}</span>,
	);
	return (
		<SidebarMenuItem>
			<SidebarMenuButton isActive={active}>{parts}</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

/** The count at the end of a row. */
function SidebarCount({ tone, children }: { tone?: "default" | "warning"; children?: React.ReactNode }) {
	return <SidebarMenuBadge tone={tone}>{children}</SidebarMenuBadge>;
}

/** The folders under a row. */
function SidebarSub({ children }: { children?: React.ReactNode }) {
	return (
		<SidebarMenuItem>
			<SidebarMenuSub>{children}</SidebarMenuSub>
		</SidebarMenuItem>
	);
}

/** One folder under a row: its name and its count; `depth` for a folder inside another. */
function SidebarSubItem({
	active,
	depth,
	children,
}: {
	active?: boolean;
	depth?: 0 | 1 | 2 | 3;
	children?: React.ReactNode;
}) {
	return (
		<li>
			<SidebarMenuSubButton isActive={active} depth={depth}>
				{children}
			</SidebarMenuSubButton>
		</li>
	);
}

/** The screen mode in the foot: three cells, or (folded) one button that opens them, `defaultOpen` drawn open. */
function SidebarScreenMode({
	value = "system",
	label,
	system,
	light,
	dark,
	defaultOpen,
}: {
	value?: "system" | "light" | "dark";
	label?: string;
	system?: string;
	light?: string;
	dark?: string;
	defaultOpen?: boolean;
}) {
	return (
		<SidebarScreenModePart
			value={value}
			defaultOpen={defaultOpen}
			labels={{ label: label ?? "", system: system ?? "", light: light ?? "", dark: dark ?? "" }}
		/>
	);
}

/** One thing to do from an empty list: its place in the order (`number`, "01") and its title. */
function EmptyStep({ number, title, className }: { number?: string; title?: string; className?: string }) {
	return (
		<EmptyStepPart number={number} className={className}>
			{title}
		</EmptyStepPart>
	);
}

/**
 * A list: its head row and its rows in one table, so the columns line up (a board draws them as two neighbours). When the head gives its columns
 * widths, the table keeps them whatever the rows hold, as the board's grid does.
 */
function List({ children }: { children?: React.ReactNode }) {
	return (
		// A column's name may run past its width into the gap, as the board lets it, rather than be cut.
		<Table
			container="none"
			className="has-[th[style*=width]]:table-fixed [&_th_.truncate]:overflow-visible [&_th_.truncate]:text-clip"
		>
			{children}
		</Table>
	);
}

/** A list's head row, as it looks: its columns at the widths the board gives them, and the cell at its end. */
function ListHead({ addLabel, ...props }: React.ComponentProps<typeof ListHeadPart> & { addLabel?: string }) {
	// The + shows only while some column is off; the board draws it, so it stands for the columns it would offer.
	const add = addLabel ? { label: addLabel, columns: [{ id: "more", label: addLabel }], onAdd: () => {} } : undefined;
	return <ListHeadPart {...props} add={add} />;
}

/** A row's title cell: the title (the way into it) and its address, or a folder's name and what it holds. */
function TitleCell({ title, address, folder }: { title?: string; address?: string; folder?: boolean }) {
	return (
		<TableCell truncate>
			<RowTitle folder={folder} title={<RowLink>{title}</RowLink>} address={address} />
		</TableCell>
	);
}

/** A cell of a count, a language's or a date's: mono and quiet. */
function CountCell({
	align,
	tone,
	children,
}: {
	align?: "start" | "end";
	/** `ink` in the row's own ink (a language), `muted` in the muted one (a date); without it a count's quiet ink. */
	tone?: "ink" | "muted";
	children?: React.ReactNode;
}) {
	return (
		<TableCell align={align}>
			{tone ? (
				<Text mono variant="meta" tone={tone === "muted" ? "muted" : undefined}>
					{children}
				</Text>
			) : (
				<Count>{children}</Count>
			)}
		</TableCell>
	);
}

/** A row's worded link in a cell of its own (a category's "글 3", going to its entries). */
function LinkCell({ label, underline }: { label?: string; underline?: boolean }) {
	return (
		<TableCell align="end">
			<RowActions>
				<TextButton variant={underline ? "underline" : undefined} size="note">
					{label}
				</TextButton>
			</RowActions>
		</TableCell>
	);
}

/** The ⋯ at the end of a row. */
function ActionsCell({ label }: { label?: string }) {
	return (
		<TableCell align="end">
			<RowActions>
				<RowMore label={label ?? ""} />
			</RowActions>
		</TableCell>
	);
}

/** A row's check, in the left margin. */
function RowMark({ checked, label }: { checked?: boolean; label?: string }) {
	return <RowCheck checked={checked ?? false} label={label ?? ""} />;
}

/** How many rows a page holds, as the board shows it ("25개씩"). */
function PageSize({ shown, label }: { shown?: string; label?: string }) {
	return <PageSizeMenu label={label ?? ""} value={0} options={[{ value: 0, label: shown ?? "" }]} />;
}

/** The page buttons under a list. */
function Pager({ children }: { children?: React.ReactNode }) {
	return (
		<Pagination>
			<PaginationContent>{children}</PaginationContent>
		</Pagination>
	);
}

/** One page button: `current`, the page shown; `step`, the previous or next page (`off` at the first or last). */
function PageButton({
	step,
	current,
	off,
	page,
}: {
	step?: "previous" | "next";
	current?: boolean;
	off?: boolean;
	page?: string;
}) {
	return (
		<PaginationItem>
			{step === "previous" ? (
				<PaginationPrevious disabled={off} />
			) : step === "next" ? (
				<PaginationNext disabled={off} />
			) : (
				<PaginationLink isActive={current}>{page}</PaginationLink>
			)}
		</PaginationItem>
	);
}

/** A table with no head row: its rows only. */
function ListBody({ children }: { children?: React.ReactNode }) {
	return (
		<Table container="none">
			<TableBody>{children}</TableBody>
		</Table>
	);
}

/** A title cell of two lines: the title (the way in) and a quiet line under it (a template's sections). */
function TwoLineTitleCell({ title, note }: { title?: string; note?: string }) {
	return (
		<TableCell truncate>
			<RowLink>{title}</RowLink>
			<Text as="div" variant="note" tone="subtle" truncate>
				{note}
			</Text>
		</TableCell>
	);
}

/** A trash row's title cell: the title, its address, and the line under it. */
function TrashTitleCell({
	title,
	address,
	meta,
	folder,
	metaTone,
}: {
	title?: string;
	address?: string;
	meta?: string;
	folder?: boolean;
	metaTone?: "default" | "warning";
}) {
	return (
		<TableCell truncate>
			<TrashRowTitle title={title} address={address} meta={meta} folder={folder} metaTone={metaTone} />
		</TableCell>
	);
}

/** A trash row's day it was thrown away, and the days left. */
function TrashDateCell({ date, left, urgent }: { date?: string; left?: string; urgent?: boolean }) {
	return (
		<TableCell align="end">
			<TrashRowDate date={date} left={left} urgent={urgent} />
		</TableCell>
	);
}

/** A row's own buttons at its end (a word button, then ⋯). */
function RowButtonsCell({ children }: { children?: React.ReactNode }) {
	return (
		<TableCell align="end">
			<RowActions>
				<Inline gap={16}>{children}</Inline>
			</RowActions>
		</TableCell>
	);
}

/** The app frame's ✦ in the page's top-right corner, 12px from both edges, as `SidebarInset` places its `corner`. It opens the assistant. */
function AssistantCorner({ label }: { label?: string }) {
	return (
		<div className="fixed top-monti-12 right-monti-12 z-10">
			<IconButton label={label ?? ""}>
				<Icon name="spark" />
			</IconButton>
		</div>
	);
}

/** A ⋯: the round icon button of a head or a panel, or (`letter`) the row's letter, as the board draws it. */
function MoreButton({ label, letter }: { label?: string; letter?: boolean }) {
	if (letter) return <RowMore label={label ?? ""} />;
	return (
		<IconButton label={label ?? ""}>
			<Icon name="overflow-menu--horizontal" />
		</IconButton>
	);
}

/** Words a row holds beside a part (a title before its note), in the type of what holds them. */
function Words({ children }: { children?: React.ReactNode }) {
	return <span>{children}</span>;
}

/** The site's name at the head of the sidebar. */
function SiteName({ name }: { name?: string }) {
	return <SidebarSiteName>{name}</SidebarSiteName>;
}

/** An entry's language tabs, 6px under the bar above them, as the editor draws them; `label` names them. */
function LanguageTabs({ label, children }: { label?: string; children?: React.ReactNode }) {
	return (
		<BoxPart as="nav" aria-label={label} paddingTop={6}>
			<TabLinks>{children}</TabLinks>
		</BoxPart>
	);
}

/** The + at the end of a tab row that adds one ("+ 언어"): a tab's own look, as a button. */
function TabAdd({ label }: { label?: string }) {
	return <TabLink render={<button type="button" />}>{label}</TabLink>;
}

/** One tab of a page's tab row: a page of its own, with its count. */
function Tab({
	label,
	current,
	count,
	countTone,
	dot,
}: {
	label?: string;
	current?: boolean;
	count?: string;
	countTone?: "default" | "warning";
	/** The tab has a change in it (or the assistant's proposal). */
	dot?: "warning" | "proposal";
}) {
	return (
		<TabLink current={current} count={count} countTone={countTone} dot={dot}>
			{label}
		</TabLink>
	);
}

/** A choice of this time only (a backup's "include media"): a checkbox, its words, and a quiet note after them. */
function OptionCheck({
	label,
	mono,
	note,
	noteTone,
	checked,
}: {
	label?: string;
	/** The words are a key (a heading level's tag). */
	mono?: boolean;
	note?: string;
	/** `warning` for a note that says the option changed. */
	noteTone?: "warning";
	checked?: boolean;
}) {
	// A row of options is 32px tall (`.mt-option`, 6px above and below its line).
	return (
		<Option className="py-monti-6">
			<Checkbox checked={checked ?? false} />
			{mono ? <Text mono>{label}</Text> : label}
			{note && (
				<Text variant="meta" tone={noteTone ?? "subtle"}>
					{note}
				</Text>
			)}
		</Option>
	);
}

/** A closed select showing its value (a key's state, a language). */
function SelectBox({
	value,
	size,
	width,
	proposal,
	warning,
}: {
	value?: string;
	size?: "sm" | "default";
	width?: "fit" | "full" | "choice";
	/** The assistant picked the value and nobody has touched it. */
	proposal?: boolean;
	/** The value is in the warning ink: nothing to pick yet ("No key"). */
	warning?: boolean;
}) {
	return (
		<Select items={[{ value: "shown", label: value ?? "" }]} value="shown">
			<SelectTrigger size={size} width={width} proposal={proposal} className={cn(warning && "text-monti-warning")}>
				<SelectValue />
			</SelectTrigger>
		</Select>
	);
}

/** A condition of a filter row: its name (or its value, `filled`) and a caret. */
function Filter({ label, filled }: { label?: string; filled?: boolean }) {
	return <FilterButton filled={filled}>{label}</FilterButton>;
}

/** A line across a page that says what needs knowing: its title, a detail, and an action at its end. */
function Banner({
	title,
	meta,
	tone,
	children,
}: {
	title?: string;
	meta?: string;
	tone?: "warning" | "danger" | "neutral";
	children?: React.ReactNode;
}) {
	return (
		<BannerPart title={title} meta={meta} tone={tone}>
			{children}
		</BannerPart>
	);
}

/** A field with fixed words before or after what is typed (`/` before an address). */
function AffixField({
	value,
	prefix,
	suffix,
	placeholder,
	proposal,
}: {
	/** What is typed, from the data. */
	value?: string;
	prefix?: string;
	suffix?: string;
	placeholder?: string;
	/** The assistant wrote what is typed and nobody has touched it. */
	proposal?: boolean;
}) {
	return <Affix defaultValue={value} prefix={prefix} suffix={suffix} placeholder={placeholder} proposal={proposal} />;
}

/** The saved value an assistant's proposal would replace, struck through under the field. */
function Was({ text }: { text?: string }) {
	return <FormFieldWas>{text}</FormFieldWas>;
}

/** The short upright rule between two things on a line. */
function VerticalRule({ className }: { className?: string }) {
	return <Separator orientation="vertical" length="control" className={className} />;
}

/** A cell of two lines: what it is in ink, and under it a quiet line (an event's "what" and "where"); the assistant's ✦ before what it made. */
function TwoLineCell({ title, sub, proposal }: { title?: string; sub?: string; proposal?: boolean }) {
	return (
		<TableCell truncate>
			<StackPart gap={4} minWidth={0}>
				{proposal ? (
					// The assistant's request: its mark on the line of its words.
					<Inline gap={8} align="baseline" minWidth={0}>
						<Text tone="proposal" aria-hidden="true">
							✦
						</Text>
						<Text truncate>{title}</Text>
					</Inline>
				) : (
					<Text as="div" truncate>
						{title}
					</Text>
				)}
				{/* The line under the title stands in a 20px line, as the title does (`.mt-row-sub`). */}
				<Text as="div" variant="meta" tone="subtle" truncate className="py-monti-2">
					{sub}
				</Text>
			</StackPart>
		</TableCell>
	);
}

/** The save group of a settings screen, as it looks: "changes N", "undo all", the pill. Its list and its actions are wired later. */
function SaveGroup({
	label,
	count,
	proposalsLabel,
	proposalsCount,
	discardLabel,
	saveLabel,
	saveDisabled,
}: {
	label?: string;
	count?: number;
	/** "proposals" and how many, while the assistant's proposals wait in the form. */
	proposalsLabel?: string;
	proposalsCount?: number;
	discardLabel?: string;
	saveLabel?: string;
	saveDisabled?: boolean;
}) {
	return (
		<ChangesBar
			label={label ?? ""}
			count={Number(count ?? 0)}
			proposalsLabel={proposalsLabel}
			proposalsCount={proposalsCount}
			discardLabel={discardLabel ?? ""}
			saveLabel={saveLabel ?? ""}
			saveDisabled={saveDisabled}
		/>
	);
}

/** A field's label with the dot of a change and, at the end of its row, the quiet undo. */
function ChangedLabel({
	label,
	undo,
	proposal,
	for: field,
}: {
	label?: string;
	undo?: string;
	/** The value is the assistant's and nobody has taken it yet: the dot is blue and the button discards it. */
	proposal?: boolean;
	for?: string;
}) {
	return (
		<FormFieldLabelPart
			htmlFor={field}
			changed={{
				label: "",
				undoLabel: undo ?? "",
				undoShown: Boolean(undo),
				tone: proposal ? "proposal" : undefined,
			}}
		>
			{label}
		</FormFieldLabelPart>
	);
}

/** A field of several lines: what it holds is its `bind`. */
function Textarea({
	id,
	name,
	value,
	rows,
	mono,
}: {
	id?: string;
	name?: string;
	value?: string;
	rows?: number;
	mono?: boolean;
}) {
	return <TextareaPart id={id} name={name} defaultValue={value} rows={rows} mono={mono} />;
}

/** A list's section: its heading (the first child, a board's heading row) over its rows. */
function ListSection({
	count,
	countTone,
	children,
}: {
	count?: string;
	countTone?: "default" | "warning";
	children?: React.ReactNode;
}) {
	const [heading, ...rows] = React.Children.toArray(children);
	return (
		<ListSectionPart title={heading} count={count} countTone={countTone}>
			{rows}
		</ListSectionPart>
	);
}

/** A list section's rows, in its section. */
function ListSectionRows({ children }: { children?: React.ReactNode }) {
	return <>{children}</>;
}

/** A section's list of languages: its rows. */
function LanguageList({ children }: { children?: React.ReactNode }) {
	return <ul className="m-0 list-none p-0">{children}</ul>;
}

/** One content language: its own name, code and display name; `handle` when it can be dragged, `handled` when its list can be reordered. */
function LanguageLine({
	name,
	code,
	label,
	dot,
	gone,
	handle,
	handled,
	handleLabel,
	children,
}: {
	/** The handle's name for a screen reader ("move Korean"). */
	handleLabel?: string;
	name?: string;
	code?: string;
	label?: string;
	dot?: string;
	gone?: boolean;
	handle?: boolean;
	handled?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<LanguageRow
			name={name}
			code={code ?? ""}
			label={label}
			dot={dot}
			gone={gone}
			handled={handled}
			handle={handle ? <DragHandle aria-label={handleLabel} /> : undefined}
		>
			{children}
		</LanguageRow>
	);
}

/** The source language's mark at the end of its row: the bold word, a rule, the button that changes it. */
function LanguageSourceMark({ flag, children }: { flag?: string; children?: React.ReactNode }) {
	// A translation's row has no mark: only its own buttons.
	return flag ? <LanguageSource flag={flag}>{children}</LanguageSource> : <>{children}</>;
}

/** A panel beside the page: its title, its actions (⋯) and × in its head, what it holds, and its footer. */
function Panel({
	title,
	closable,
	width,
	bleed,
	actions,
	footer,
	composer,
	children,
}: {
	title?: string;
	closable?: boolean;
	width?: "side" | "panel" | "assistant";
	/** The body keeps no padding of its own: what it holds lays itself out (the assistant's conversation). */
	bleed?: boolean;
	actions?: React.ReactNode;
	footer?: React.ReactNode;
	/** The box to type in, pinned under the body (the assistant's). */
	composer?: React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<SidePanel
			title={title}
			closable={closable}
			width={width}
			bleed={bleed}
			actions={actions}
			footer={footer}
			composer={composer}
		>
			{children}
		</SidePanel>
	);
}

/** An icon button by its icon's name (a head's ⋯, a page's search). */
function IconOnlyButton({ icon, label }: { icon?: IconName; label?: string }) {
	return <IconButton label={label ?? ""}>{icon && <Icon name={icon} />}</IconButton>;
}

/** A list beside the content (the collections): `rail`, the list, and the content after it. */
function Rail({ label, rail, children }: { label?: string; rail?: React.ReactNode; children?: React.ReactNode }) {
	return (
		<RailLayout label={label ?? ""} rail={rail}>
			{children}
		</RailLayout>
	);
}

/** One entry of a list beside the content: its name, a mono note (its identifier), the open one `active`, a changed one with a dot. */
function NavEntry({ label, note, active, dot }: { label?: string; note?: string; active?: boolean; dot?: string }) {
	return (
		<NavLink active={active} note={note} dot={dot}>
			{label}
		</NavLink>
	);
}

/** A setting turned on or off at once: its words at the start, the switch at the end. */
function OptionSwitch({ label, checked }: { label?: string; checked?: boolean }) {
	return (
		<Option spread>
			{label}
			<Switch checked={checked ?? false} />
		</Option>
	);
}

/** Children in equal columns (a collection's editor options, three across): rows 4px apart, columns 24 (`.opt-grid`). */
function GridBox({ columns, children }: { columns?: 1 | 2 | 3 | 4 | 6; children?: React.ReactNode }) {
	return (
		<Grid columns={columns} gap={4} className="gap-x-monti-24">
			{children}
		</Grid>
	);
}

/** What cannot be undone, apart at the end of a page: its title in danger, its rows under it. */
function DangerSection({ title, children }: { title?: string; children?: React.ReactNode }) {
	// The room above it is the screen's (a Spacing before it), so the block is drawn without its own.
	return (
		<DangerBlock title={title} className="mt-0">
			{children}
		</DangerBlock>
	);
}

/** One thing that cannot be undone: its name, a detail, and its button. */
function DangerLine({ name, meta, action }: { name?: string; meta?: string; action?: React.ReactNode }) {
	return <DangerRow name={name} meta={meta} action={action} />;
}

/** The quiet button under a list beside the content ("+ New collection"). */
function RailAdd({ label }: { label?: string }) {
	return <RailAction>{label}</RailAction>;
}

/** A value shown as text under its label, with no field (what cannot be edited here); `mono` for an identifier or an address. */
function ReadValue({ label, mono, children }: { label?: string; mono?: boolean; children?: React.ReactNode }) {
	return (
		<ReadValuePart label={label ?? ""} mono={mono ?? false}>
			{children}
		</ReadValuePart>
	);
}

/** The lock after a value nobody can change. */
function Lock({ label }: { label?: string }) {
	return <LockMark label={label ?? ""} />;
}

/** The design system's line: `bottom-contrast` is the ink rule under a title. Only the line; a box's other options are not a screen spec's. */
function Box({ border, className }: { border: "top" | "bottom" | "bottom-contrast"; className?: string }) {
	return <BoxPart border={border} className={className} />;
}

/**
 * Monti's screen pack: what the screen spec tool (`../spec`) needs from Monti's design system. The tool knows no part, token or class of its own; this
 * folder gives them: the parts and their kinds here, the spacing classes (`spacing.ts`), the renderer (`index.tsx`), the HTML board's classes
 * (`html-board.js`) and the scripts' settings (`pack.mjs`).
 *
 * `SCREEN`: the steps of the spacing scale (the design system's spacing tokens but 0) and the layout entry a plain group becomes.
 */
/** The open tab of a `Folder`, which its body is the panel of. */
const FolderOpen = React.createContext("");

/** A list of fields split into tabbed pages: its `FolderTabRow` and then its `FolderBody`; `open` names the open tab. */
function Folder({ open, children }: { open?: string; children?: React.ReactNode }) {
	return (
		<FolderOpen.Provider value={open ?? ""}>
			<FolderTabs value={open ?? ""}>{children}</FolderTabs>
		</FolderOpen.Provider>
	);
}

/** The row of a folder's tabs; `add` names the button after them that adds one. */
function FolderTabRow({ add, children }: { add?: string; children?: React.ReactNode }) {
	return <FolderTabsList add={add ? <FolderTabsAdd aria-label={add} /> : undefined}>{children}</FolderTabsList>;
}

/** One tab of a folder: its name, how many fields it holds, `locked` for one a plugin placed, `fixed` for one that is not dragged. */
function FolderTabItem({
	label,
	count,
	locked,
	fixed,
}: {
	label?: string;
	count?: string;
	locked?: boolean;
	fixed?: boolean;
}) {
	return (
		<FolderTab value={label ?? ""} count={count} locked={locked} draggable={!fixed}>
			{label}
		</FolderTab>
	);
}

/** The box under a folder's tabs, holding the open tab's fields. */
function FolderBody({ children }: { children?: React.ReactNode }) {
	const open = React.useContext(FolderOpen);
	return <FolderTabsBody value={open}>{children}</FolderTabsBody>;
}

/** The outline of a collection's fields: its `FieldLine`s. */
function FieldTree({ children }: { children?: React.ReactNode }) {
	return <FieldTreePart>{children}</FieldTreePart>;
}

/**
 * One line of a field outline: the key (`name`), what the admin sees (`label`, its help after it as `description`, a short `note`), the `kind` at the end.
 * `depth` 1 for a field in a group; `group` for a group's own line; `tone` colours the name for a change; `locked` names the lock of a field a plugin
 * placed; `fixed` for a line with no grip (nothing can be moved).
 */
function FieldLine({
	name,
	label,
	description,
	note,
	kind,
	depth,
	group,
	tone,
	locked,
	fixed,
}: {
	name?: string;
	label?: string;
	description?: string;
	note?: string;
	kind?: string;
	depth?: 0 | 1 | 2;
	group?: boolean;
	tone?: "warning" | "success" | "danger" | "faint";
	locked?: string;
	fixed?: boolean;
}) {
	return (
		<FieldRow
			name={name}
			label={label}
			description={description}
			note={note}
			kind={kind}
			depth={depth}
			group={group}
			tone={tone}
			locked={locked}
			grip={!fixed}
		/>
	);
}

/**
 * Work with several inputs, open over the screen from the right (add a field, review a save): its `title`, what it is about (`of`), its body
 * (`SheetBody` or `SheetSplit`) and the `footer` with cancel and the one pill. It dims the screen under it.
 */
function Sheet({
	title,
	of,
	footer,
	children,
}: {
	title?: string;
	of?: string;
	footer?: React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<SheetRoot open>
			<SheetContent>
				<SheetHeader>
					<SheetTitle of={of} ofMono={false}>
						{title}
					</SheetTitle>
				</SheetHeader>
				{children}
				{footer && <SheetFooter>{footer}</SheetFooter>}
			</SheetContent>
		</SheetRoot>
	);
}

/** What a sheet is for, scrolling when it is long; `blocks` for a run of change blocks, which bring their own room above. */
function SheetBody({ blocks, children }: { blocks?: boolean; children?: React.ReactNode }) {
	return <SheetBodyPart blocks={blocks}>{children}</SheetBodyPart>;
}

/** A sheet's body in two: `list` on the left (the kinds of a new field), the work on the right. */
function SheetSplit({ list, children }: { list?: React.ReactNode; children?: React.ReactNode }) {
	return <SheetSplitPart list={list}>{children}</SheetSplitPart>;
}

/** A short list of kinds to pick one from, with the picked one marked (the kind of a new field). */
function KindList({ label, children }: { label?: string; children?: React.ReactNode }) {
	return <PickList aria-label={label}>{children}</PickList>;
}

/** One kind of a `KindList`: its name, `selected` for the picked one, `mark` when picking it opens more (→). */
function KindItem({ label, selected, mark }: { label?: string; selected?: boolean; mark?: string }) {
	return (
		<PickListItem selected={selected} mark={mark}>
			{label}
		</PickListItem>
	);
}

/** The tab row at the top of a pane (a sheet's Basic and Advanced): `open` names the picked tab, the tabs are its `PaneTab`s. */
function PaneTabs({ open, children }: { open?: string; children?: React.ReactNode }) {
	return (
		<TabsRoot value={open ?? ""}>
			<TabsList variant="bar">{children}</TabsList>
		</TabsRoot>
	);
}

/** One tab of `PaneTabs`. */
function PaneTab({ label }: { label?: string }) {
	return <TabsTrigger value={label ?? ""}>{label}</TabsTrigger>;
}

/** A short choice of one among a few, joined in one frame; `options` are the cells and `picked` the one picked. */
function SegmentedChoice({
	label,
	options,
	picked,
	size,
	inline,
}: {
	label?: string;
	options?: readonly { value: string; label: string }[];
	picked?: string;
	/** `sm` in a toolbar or a panel. */
	size?: "md" | "sm";
	/** As wide as its cells, not its container (a toolbar's view switch). */
	inline?: boolean;
}) {
	return (
		<Segmented
			aria-label={label}
			value={picked ?? null}
			onValueChange={() => {}}
			options={options ?? []}
			size={size}
			inline={inline}
		/>
	);
}

/** A choice of one among options in rows, each with a round mark: `picked` names the picked row, the rows are its `Choice`s. */
function Choices({ label, picked, children }: { label?: string; picked?: string; children?: React.ReactNode }) {
	return (
		<RadioGroup aria-label={label} value={picked ?? null}>
			{children}
		</RadioGroup>
	);
}

/** One row of `Choices`: its words, a quiet `description` after them, a mono `hint` ("148 posts") and a `control` at its end. */
function Choice({
	label,
	description,
	hint,
	control,
}: {
	label?: string;
	description?: string;
	hint?: string;
	control?: React.ReactNode;
}) {
	return <RadioItem value={label ?? ""} label={label} description={description} hint={hint} control={control} />;
}

/** One change of a schema review: its `kind`, its `tag`, the field's name (`title`) and key (`identifier`), and what to do with saved data under it. */
function Change({
	kind,
	tag,
	title,
	identifier,
	children,
}: {
	kind?: "new" | "edit" | "drop";
	tag?: string;
	title?: string;
	identifier?: string;
	children?: React.ReactNode;
}) {
	return (
		<ChangeGroup kind={kind ?? "edit"} tag={tag ?? ""} title={title} identifier={identifier}>
			{children}
		</ChangeGroup>
	);
}

/** The result of a change's choice in one line; `danger` when it cannot be undone. */
function ChangeResult({ text, danger }: { text?: string; danger?: boolean }) {
	return <ChangeNote danger={danger}>{text}</ChangeNote>;
}

/** What a change sets, a name and its value per line: its `ChangeRow`s. */
function ChangeRows({ children }: { children?: React.ReactNode }) {
	return <ChangeLines>{children}</ChangeLines>;
}

/** One line of `ChangeRows`: `what` on the left, its `result` on the right. */
function ChangeRow({ what, result }: { what?: string; result?: string }) {
	return <ChangeLine what={what} then={result} />;
}

/** What a sheet will make, in one quiet line at the end of its body. */
function SheetSummary({ text }: { text?: string }) {
	return <SheetSummaryPart>{text}</SheetSummaryPart>;
}

/** Where files can be dropped (the folders and the file grid); `over` while files are dragged over it. */
function DropZone({ over, children }: { over?: boolean; children?: React.ReactNode }) {
	return <DropArea over={over}>{children}</DropArea>;
}

/** The grid of a library's files (`MediaTile`s), or of its folders (`folders`), set in from the column as the design system's tiles are. */
function MediaGrid({ folders, children }: { folders?: boolean; children?: React.ReactNode }) {
	return (
		<BoxPart paddingTop={24} paddingX={12}>
			<Grid columns={folders ? "folders" : "tiles"}>{children}</Grid>
		</BoxPart>
	);
}

/**
 * One file of a grid: its `name`, the `detail` line, its picture (`picture`, a file's address, read from the data) or, for a file with none, its
 * extension (`ext`). `status` for a file going up or one that cannot be taken, with `progress`; `actions` are what can be done with a failed one.
 */
function MediaTile({
	name,
	detail,
	picture,
	ext,
	status,
	progress,
	actions,
	selected,
	picking,
}: {
	name?: string;
	detail?: string;
	picture?: string;
	ext?: string;
	status?: "ready" | "uploading" | "failed" | "interrupted";
	progress?: number;
	actions?: readonly { label: string }[];
	selected?: boolean;
	picking?: boolean;
}) {
	// A picture is an address; a board's sample paints a colour in its place, drawn as it is.
	const address = picture && /^(https?:|\/|data:)/.test(picture) ? picture : undefined;
	return (
		<Tile
			title={name}
			detail={detail}
			preview={
				ext ? (
					<FilePreview ext={ext} />
				) : address ? (
					<ImagePart src={address} alt="" ratio="photo" radius="none" />
				) : picture ? (
					<SamplePicture paint={picture} />
				) : null
			}
			status={status}
			progress={progress}
			actions={actions?.map((action) => ({ label: action.label, onClick: () => {} }))}
			selected={selected}
			picking={picking}
		/>
	);
}

/** A folder of a library: its `name` and how many files it holds; `up` for the tile that goes one level up. */
function FolderEntry({
	name,
	count,
	up,
	selected,
}: {
	name?: string;
	count?: number;
	up?: boolean;
	selected?: boolean;
}) {
	return (
		<FolderTile name={name} count={count} selected={selected} icon={up ? <FolderParent aria-hidden /> : undefined} />
	);
}

/** The folders above the one open, in a page header's trail: links with a slash after each, named by `label`. */
function Trail({ label, children }: { label?: string; children?: React.ReactNode }) {
	return (
		<Inline as="nav" gap={6} aria-label={label}>
			{children}
		</Inline>
	);
}

/** The slash between two folders of a `Trail`. */
function TrailSlash() {
	return <span aria-hidden="true">/</span>;
}

/** A run of an entry's words with what a change takes out (`del`) and puts in (`ins`), as the data gives it. */
type Marked = readonly { kind?: string; text: string }[];

function marked(run: Marked | undefined) {
	return run?.map((piece, index) =>
		piece.kind === "del" ? (
			<Del key={index}>{piece.text}</Del>
		) : piece.kind === "ins" ? (
			<Ins key={index}>{piece.text}</Ins>
		) : (
			piece.text
		),
	);
}

/** What the admin asked, quoted under a review page's title (the admin's own words, from the data). */
function ReviewAsk({ text }: { text?: string }) {
	// The room above it is the screen's (a Spacing before it), so the quote is drawn without its own.
	return <ReviewQuote className="mt-0">{text}</ReviewQuote>;
}

/** The head of a group of changes: its name, what and how much (`meta`), and what applies to the whole group (`actions`). Its rows follow it. */
function ReviewHead({ title, meta, actions }: { title?: string; meta?: string; actions?: React.ReactNode }) {
	// The room above it is the screen's (a Spacing before it), so the group is drawn without its own.
	return <ReviewGroup title={title} meta={meta} actions={actions} className="mt-0" />;
}

/**
 * One change of a review: its check (`included`), what it is about (`title`, `path`: an entry's, from the data), how it went at the end (`end`), and
 * the change itself under it (`change`, marked words from the data). `muted` when it cannot be applied any more.
 */
function ReviewEntry({
	title,
	path,
	end,
	again,
	change,
	included,
	muted,
	endWarning,
}: {
	title?: string;
	path?: string;
	end?: string;
	/** What can be done about how it went ("Make again"), after `end`. */
	again?: string;
	change?: Marked;
	included?: boolean;
	muted?: boolean;
	/** `end` in the warning ink: the entry changed since the proposal was made ("이 사이에 고쳐짐"). */
	endWarning?: boolean;
}) {
	const endWords = endWarning ? <span className="text-monti-warning">{end}</span> : end;
	return (
		<ReviewItem
			included={included ?? false}
			includeLabel=""
			title={title}
			path={path}
			end={
				again ? (
					<>
						{endWords}{" "}
						<TextButton variant="underline" size="caption">
							{again}
						</TextButton>
					</>
				) : (
					endWords
				)
			}
			muted={muted}
		>
			{change ? marked(change) : undefined}
		</ReviewItem>
	);
}

/** One block's change on one line: its check, the block's name (`label`, a `note` under it), its words marked (`text`, from the data). */
function ReviewBlockLine({
	label,
	note,
	text,
	included,
}: {
	label?: string;
	note?: string;
	text?: Marked;
	included?: boolean;
}) {
	return (
		<ReviewLine included={included ?? false} includeLabel="" label={label} note={note}>
			{marked(text)}
		</ReviewLine>
	);
}

/** One block's change side by side: its check and name, the words now (`before`) and proposed (`after`), from the data. */
function ReviewBlockCompare({
	label,
	note,
	before,
	after,
	included,
}: {
	label?: string;
	note?: string;
	before?: Marked;
	after?: Marked;
	included?: boolean;
}) {
	return (
		<ReviewCompare
			included={included ?? false}
			includeLabel=""
			label={label}
			note={note}
			before={marked(before)}
			after={marked(after)}
		/>
	);
}

/** The column names over side-by-side changes. */
function ReviewColumns({ before, after }: { before?: string; after?: string }) {
	return <ReviewCompareHead before={before} after={after} />;
}

/** The way to the rest of a long group ("6 more"). */
function ReviewRest({ label }: { label?: string }) {
	return <ReviewMore open={false} onOpenChange={() => {}} moreLabel={label ?? ""} lessLabel="" />;
}

/** The head of an editor: the way back, where the entry lives and its state, then saving, publishing and the editor's tools. */
function EditorTopBar({ start, end }: { start?: React.ReactNode; end?: React.ReactNode }) {
	return (
		<EditorHeader>
			<Inline gap={12} minWidth={0} paddingX={12}>
				{start}
			</Inline>
			<Inline gap={12} justify="end">
				{end}
			</Inline>
		</EditorHeader>
	);
}

/** The pill that publishes, with the caret half that opens the other ways to (`menuLabel` names it). */
function PublishButton({ label, menuLabel }: { label?: string; menuLabel?: string }) {
	return (
		<SplitButton menuLabel={menuLabel ?? ""} menu={null}>
			{label}
		</SplitButton>
	);
}

/** An entry's title, as large as a page's; the words are the entry's (from the data). */
function EntryTitle({ text, faint, untranslated }: { text?: string; faint?: boolean; untranslated?: boolean }) {
	return (
		<Heading as="h1" variant="display" tone={faint ? "subtle" : undefined}>
			{untranslated ? <Untranslated>{text}</Untranslated> : text}
		</Heading>
	);
}

/** A name typed as large as a page's title (a template's), with no line: it reads as the title until it has focus. */
function TitleInput({
	id,
	value,
	placeholder,
	label,
}: {
	id?: string;
	value?: string;
	placeholder?: string;
	label?: string;
}) {
	return <InputPart id={id} defaultValue={value} placeholder={placeholder} aria-label={label} size="display" />;
}

/** The ink rule under an entry's title. */
function TitleRule() {
	// The room above it is the screen's (a Spacing before it), so the line is drawn without its own.
	return <EditorTitleRule className="pt-0" />;
}

/**
 * An entry's body: where the editor goes. The spec says only that the body is here; its blocks come from the data (`doc`: each block's `kind`, `h2`,
 * `h3`, `p`, `quote`, `figure` or `placeholder`, and its `text`), drawn in the editor's reading type. The editor itself takes this place when the
 * screen is wired. What the board shows open in it (a block's handle and menu, the format bar, a proposal's mark and card) comes from the data too
 * (`tools`), drawn with the design system's editor parts at the places the board gives them.
 */
function EditorBody({
	doc,
	tools,
	muted,
}: {
	doc?: readonly BodyPiece[];
	tools?: readonly ToolPiece[];
	/** Read only, in the quiet ink (the source beside a translation). */
	muted?: boolean;
}) {
	return (
		<div
			className={cn(
				"prose monti-dark:prose-invert relative max-w-none text-monti-reading",
				muted ? "text-monti-muted" : "text-monti-default",
			)}
		>
			{bodyOf(doc).map((block, index) => {
				const key = index;
				const run = block.pieces.map((piece, at) =>
					piece.mark === "del" ? (
						<Del key={at}>{piece.text}</Del>
					) : piece.mark === "ins" ? (
						<Ins key={at}>{piece.text}</Ins>
					) : piece.mark === "anchor" ? (
						<span key={at} className={PROPOSAL_MARK_CLASSES.anchor}>
							{piece.text}
						</span>
					) : piece.mark === "strong" ? (
						<strong key={at}>{piece.text}</strong>
					) : (
						piece.text
					),
				);
				// A block still in the source's language reads faint until it is translated.
				const text = block.untranslated ? <Untranslated>{run}</Untranslated> : run;
				const own = toolsOf(tools).filter((tool) => tool.block === index);
				const drawn = blockOf(block, text);
				// The board's own distance above the block, when it gives one: the block keeps no margin of its own then.
				const spaced =
					block.gap === undefined ? (
						drawn
					) : (
						<div style={{ paddingTop: block.gap }} className={cn("*:my-0", block.muted && "text-monti-muted")}>
							{drawn}
						</div>
					);
				if (own.length === 0 && !block.active && !block.current)
					return <React.Fragment key={key}>{spaced}</React.Fragment>;
				// A block the board shows a state of: the block, then its tools at their places beside it.
				return (
					<div key={key} className={cn("relative", block.current && PROPOSAL_MARK_CLASSES.current)}>
						{block.active ? (
							<div style={{ paddingTop: block.gap }} className={cn(block.muted && "text-monti-muted")}>
								<Block active className="-ml-monti-8 py-monti-2 *:my-0">
									{drawn}
								</Block>
							</div>
						) : (
							spaced
						)}
						{own.map((tool, at) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: a block's tools never move
							<div
								key={at}
								className="absolute z-3"
								style={{ left: tool.x, top: tool.y + (block.gap ?? 0), width: tool.width }}
							>
								{toolOf(tool)}
							</div>
						))}
					</div>
				);
			})}
		</div>
	);
}

/** One block of the body in the editor's own spacing (as a side-by-side view draws it), not the reading defaults. */
function blockOf(block: BodyBlock, text: React.ReactNode) {
	// A heading takes the body's ink (muted in a read-only source), not the reading defaults' own.
	if (block.kind === "h2" || block.kind === "h3")
		return <CompareHeading className="text-inherit first:mt-0">{text}</CompareHeading>;
	// A quote as the editor draws it: plain text after a rule, not the reading defaults' italic.
	if (block.kind === "quote")
		return (
			<blockquote className="not-prose m-0 mb-monti-20 border-monti-strong border-l-2 pl-monti-16 font-normal not-italic">
				{text}
			</blockquote>
		);
	if (block.kind === "list")
		return (
			<ul className="m-0 pl-monti-16 *:my-0 *:pl-0">
				{block.items.map((item, at) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a list's items never move
					<li key={at}>{item}</li>
				))}
			</ul>
		);
	if (block.kind === "figure")
		return (
			<figure>
				<div className="aspect-[3/2] rounded-monti-md bg-monti-muted" />
				{block.pieces.length > 0 && <figcaption>{text}</figcaption>}
			</figure>
		);
	// The line that asks for the first block: faint, with nothing under it.
	if (block.kind === "placeholder")
		return <CompareParagraph className="mt-0 mb-0 text-monti-faint">{text}</CompareParagraph>;
	return <CompareParagraph className="mt-0">{text}</CompareParagraph>;
}

/** Nothing happens when a tool drawn from a board is pressed: its looks only. */
const still = () => {};

/** One of the editor's tools, drawn open with the design system's parts. */
function toolOf(tool: BodyTool) {
	const items = tool.items;
	if (tool.kind === "handle") return <BlockHandle addLabel="" gripLabel="" active={tool.on} />;
	if (tool.kind === "marker")
		return (
			<Marker active={tool.on} onClick={still}>
				{tool.text}
			</Marker>
		);
	if (tool.kind === "menu")
		return (
			<div role="menu" className={cn(MENU_CARD, "p-monti-6")}>
				{items.map((item, at) =>
					item.kind === "label" ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: a menu's rows never move
						<span key={at} className={MENU_LABEL}>
							{item.text}
						</span>
					) : item.kind === "sep" ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: a menu's rows never move
						<span key={at} className={MENU_SEPARATOR} />
					) : (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: a menu's rows never move
							key={at}
							role="menuitem"
							data-highlighted={item.on || undefined}
							className={MENU_ITEM}
						>
							{item.icon && <Icon name={item.icon} />}
							{item.text}
							{item.key && <MenuShortcut>{item.key}</MenuShortcut>}
							{item.sub && (
								<span className={MENU_SUB_MARK}>
									<Icon name="chevron--right" />
								</span>
							)}
						</span>
					),
				)}
			</div>
		);
	if (tool.kind === "format")
		return (
			<FloatingBar>
				{items.map((item, at) =>
					item.kind === "sep" ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: a bar's buttons never move
						<Separator key={at} orientation="vertical" length="bar" />
					) : item.kind === "ask" ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: a bar's buttons never move
						<FormatBarRequest key={at} label={item.text ?? ""} />
					) : (
						<FormatButton
							// biome-ignore lint/suspicious/noArrayIndexKey: a bar's buttons never move
							key={at}
							mark={item.kind as FormatMark}
							label={item.text ?? ""}
							pressed={item.on}
						/>
					),
				)}
			</FloatingBar>
		);
	return (
		<MemoCard
			discardLabel={tool.discard}
			onDiscard={tool.discard ? still : undefined}
			acceptLabel={tool.accept}
			onAccept={tool.accept ? still : undefined}
			reply={
				tool.text
					? { placeholder: tool.text, value: "", onValueChange: still, onSend: still, sendLabel: tool.text }
					: undefined
			}
		>
			<MemoThread>
				{items.map((message, at) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a note's messages never move
					<MemoMessage key={at} author={message.label ?? ""} time={message.key} ai={message.kind === "ai"}>
						{message.text}
					</MemoMessage>
				))}
			</MemoThread>
		</MemoCard>
	);
}

/**
 * The source beside a translation, read only: on the tool ground with a line at its right edge, a quiet line naming it (`label`), the source's title
 * (from the data), the rule, and its body (an `EditorBody`, muted).
 */
function SourceColumn({ label, title, children }: { label?: string; title?: string; children?: React.ReactNode }) {
	return (
		<BoxPart as="aside" aria-label={label} background="tool" border="right" grow minWidth={0}>
			<BoxPart paddingX={40} paddingTop={16} paddingBottom={48} maxWidth="reading" className="mx-auto">
				<Inline minHeight="icon-button">
					<Text variant="meta" tone="subtle">
						{label}
					</Text>
				</Inline>
				<BoxPart paddingTop={16} paddingBottom={20}>
					<Heading as="h1" variant="display" tone="muted">
						{title}
					</Heading>
				</BoxPart>
				<BoxPart border="top" paddingTop={32}>
					{children}
				</BoxPart>
			</BoxPart>
		</BoxPart>
	);
}

/**
 * The line over a translation's title: its language tabs, and at the end what the assistant can do for the whole entry. As tall as the source's quiet
 * line beside it, so both titles start on one line.
 */
function LanguageBar({ tabs, action }: { tabs?: React.ReactNode; action?: React.ReactNode }) {
	return (
		<Inline minHeight="icon-button" justify="between" gap={12}>
			{tabs}
			{action}
		</Inline>
	);
}

type BodyPiece = {
	kind?: string;
	text: string;
	mark?: string;
	/** How far the block sits below the one before, in px (the first, below the body's top), as the board draws it. */
	gap?: number;
	/** The block's words in the quiet ink (a template's guide text). */
	muted?: boolean;
	untranslated?: boolean;
	active?: boolean;
	current?: boolean;
};
type BodyBlock = {
	kind: string;
	pieces: BodyPiece[];
	gap?: number;
	muted?: boolean;
	untranslated?: boolean;
	active?: boolean;
	current?: boolean;
	items: string[];
};

/**
 * One of the editor's tools drawn open by a block, as the board shows it: `block` is the block's place in the body, `x` across from the body's left
 * edge and `y` down from the block's top. `handle` is the + and the grip (`on`: the menu is open); `menu` the block's menu (`items`: its labels, rows
 * and rules); `format` the bar over picked words (`items`: its formats, rules and the request); `marker` a proposal's tag in the margin; `memo` the
 * card under a request (`items`: its messages).
 */
type BodyTool = {
	kind: string;
	block: number;
	x: number;
	y: number;
	width?: number;
	on?: boolean;
	text?: string;
	key?: string;
	discard?: string;
	accept?: string;
	items: ToolRow[];
};
type ToolRow = {
	kind: string;
	text?: string;
	icon?: IconName;
	key?: string;
	sub?: boolean;
	on?: boolean;
	label?: string;
};
/** A tool or one of its rows, as the data lists them: a row has `row` (its kind) and goes with the tool before it. */
type ToolPiece = Omit<BodyTool, "items" | "kind" | "block" | "x" | "y"> &
	Partial<Pick<BodyTool, "kind" | "block" | "x" | "y">> & {
		row?: string;
		icon?: IconName;
		sub?: boolean;
		label?: string;
	};

/** The data's tool pieces as tools with their rows. */
function toolsOf(pieces: readonly ToolPiece[] | undefined): BodyTool[] {
	const tools: BodyTool[] = [];
	for (const { row, ...piece } of pieces ?? []) {
		if (row !== undefined) tools[tools.length - 1]?.items.push({ ...piece, kind: row });
		else
			tools.push({
				...piece,
				kind: piece.kind ?? "",
				block: piece.block ?? 0,
				x: piece.x ?? 0,
				y: piece.y ?? 0,
				items: [],
			});
	}
	return tools;
}

/** The data's pieces as blocks: a piece with a `kind` starts one, the rest go on it; list items in a row are one list. */
function bodyOf(doc: readonly BodyPiece[] | undefined) {
	const blocks: BodyBlock[] = [];
	for (const piece of doc ?? []) {
		const last = blocks[blocks.length - 1];
		if (piece.kind === "li") {
			if (last?.kind === "list" && piece.gap === undefined) last.items.push(piece.text);
			else
				blocks.push({
					kind: "list",
					pieces: [],
					items: [piece.text],
					gap: piece.gap,
					muted: piece.muted,
					active: piece.active,
				});
		} else if (piece.kind || !last) {
			blocks.push({
				kind: piece.kind ?? "p",
				pieces: piece.text ? [piece] : [],
				untranslated: piece.untranslated,
				active: piece.active,
				current: piece.current,
				gap: piece.gap,
				muted: piece.muted,
				items: [],
			});
		} else if (last.kind === "list") last.items[last.items.length - 1] += piece.text;
		else last.pieces.push(piece);
	}
	return blocks;
}

/** The bar under the editor, named by `label`: its cells, a spacer, and the cells at its end. */
function EditorStatusBar({ label, children }: { label?: string; children?: React.ReactNode }) {
	return <StatusBar aria-label={label}>{children}</StatusBar>;
}

/** One cell of the status bar: its words, `tone` for something to fix (with its dot unless `noDot`), `end` after the spacer. */
function StatusCell({
	label,
	tone,
	noDot,
	end,
}: {
	label?: string;
	tone?: "warning" | "danger";
	noDot?: boolean;
	end?: boolean;
}) {
	return (
		<StatusBarCell tone={tone} dot={!noDot} end={end}>
			{label}
		</StatusBarCell>
	);
}

/**
 * A status bar cell with its list open over it ("To do 2"): the cell's words and `tone`, the list's name (`listLabel`) and how many are left (`count`),
 * the rows to fix (from the data: each one's `title`, `detail` and `action`; `ai` when the assistant does it, `current` for the one looked at), the
 * ones done (`done`, from the data), and the list's own buttons (`footer`).
 */
function StatusListCell({
	label,
	tone,
	listLabel,
	count,
	items,
	done,
	footer,
}: {
	label?: string;
	tone?: "warning" | "danger";
	listLabel?: string;
	count?: number;
	items?: readonly { title: string; detail?: string; action?: string; ai?: boolean; current?: boolean }[];
	done?: readonly { text: string }[];
	footer?: React.ReactNode;
}) {
	return (
		<StatusBarList
			trigger={<StatusBarCell tone={tone}>{label}</StatusBarCell>}
			label={listLabel ?? ""}
			count={Number(count ?? 0)}
			defaultOpen
			footer={footer}
		>
			{items?.map((item) => (
				<TodoItem
					key={item.title}
					title={item.title}
					detail={item.detail}
					current={item.current}
					actionLabel={item.action}
					onAction={item.action ? () => {} : undefined}
					proposal={item.ai}
				/>
			))}
			{done?.map((item) => (
				<TodoDone key={item.text}>{item.text}</TodoDone>
			))}
		</StatusBarList>
	);
}

/** The room between a status bar's cells and its end cells. */
function StatusGap() {
	return <StatusBarSpacer />;
}

/**
 * Pieces of an entry's text as the data gives them: a piece with a `kind` (`h2`, `h3`, `p`) starts a block, one without goes on the block before it;
 * `changed` pieces are the words that differ between the two sides.
 */
type Pieces = readonly {
	kind?: string;
	text: string;
	changed?: boolean;
	faint?: boolean;
	picture?: string;
	label?: string;
	placeholder?: string;
	editable?: boolean;
}[];

/**
 * A side's blocks drawn with the design system's body parts: paragraphs and list items with their changed words, a callout, code, a table, and an image
 * with its fields. `source` draws the callout and code one step darker, as on the source's ground.
 */
function docBlocks(pieces: Pieces | undefined, source: boolean) {
	const out: React.ReactNode[] = [];
	const list = [...(pieces ?? [])];
	let at = 0;
	const take = (kinds: string[]) => {
		const taken = [];
		while (
			at < list.length &&
			(kinds.includes(list[at]?.kind ?? "") || (taken.length > 0 && list[at]?.kind === undefined))
		) {
			taken.push(list[at] as Pieces[number]);
			at++;
		}
		return taken;
	};
	const lines = (taken: Pieces) => {
		const blocks: Pieces[number][][] = [];
		for (const piece of taken) {
			if (piece.kind || blocks.length === 0) blocks.push([piece]);
			else blocks[blocks.length - 1]?.push(piece);
		}
		return blocks;
	};
	while (at < list.length) {
		const kind = list[at]?.kind ?? "p";
		const key = at;
		if (kind === "callout" || kind === "line") {
			out.push(
				<DocCallout key={key} source={source}>
					{lines(take(["callout", "line"])).map((line, index) => (
						<p key={index} className="m-0">
							{runOf(line)}
						</p>
					))}
				</DocCallout>,
			);
		} else if (kind === "code") {
			const code = take(["code"])[0];
			out.push(
				<DocCode key={key} source={source}>
					{code?.faint ? <Untranslated>{code.text}</Untranslated> : code?.text}
				</DocCode>,
			);
		} else if (kind === "th" || kind === "tr") {
			const rows = take(["th", "tr"]);
			const head = rows.find((row) => row.kind === "th")?.text.split("\t") ?? [];
			out.push(
				<DocTable
					key={key}
					head={head}
					rows={rows.filter((row) => row.kind === "tr").map((row) => row.text.split("\t"))}
				/>,
			);
		} else if (kind === "li") {
			out.push(
				<ul key={key} className="m-0 pl-monti-20">
					{lines(take(["li"])).map((item, index) => (
						<li key={index}>{runOf(item)}</li>
					))}
				</ul>,
			);
		} else if (kind === "image") {
			const image = list[at] as Pieces[number];
			at++;
			const fields = take(["field"]);
			out.push(
				<Inline key={key} gap={16} align="start">
					<BoxPart radius="md" className={cn("h-24 w-[140px] shrink-0 overflow-hidden", image.faint && "opacity-45")}>
						{image.picture && <SamplePicture paint={image.picture} />}
					</BoxPart>
					<StackPart gap={12} grow>
						{fields.map((field) =>
							field.editable ? (
								<FormField key={field.label}>
									<FormFieldLabelPart>{field.label}</FormFieldLabelPart>
									<InputPart defaultValue={field.text} placeholder={field.placeholder} />
								</FormField>
							) : (
								<ReadValuePart key={field.label} label={field.label ?? ""} mono={false}>
									{field.text}
								</ReadValuePart>
							),
						)}
					</StackPart>
				</Inline>,
			);
		} else {
			const block = lines(take(["p"]))[0] ?? [];
			out.push(
				<CompareParagraph key={key}>
					{block[0]?.faint ? <Untranslated>{runOf(block)}</Untranslated> : runOf(block)}
				</CompareParagraph>,
			);
		}
	}
	return out;
}

function blocksOf(pieces: Pieces | undefined) {
	const blocks: { kind: string; pieces: { text: string; changed?: boolean }[] }[] = [];
	for (const piece of pieces ?? []) {
		if (piece.kind || blocks.length === 0) blocks.push({ kind: piece.kind ?? "p", pieces: [] });
		blocks[blocks.length - 1]?.pieces.push(piece);
	}
	return blocks;
}

function runOf(pieces: readonly { text: string; changed?: boolean }[]) {
	return pieces.map((piece, index) => (
		<CompareText key={index} changed={piece.changed}>
			{piece.text}
		</CompareText>
	));
}

/** A translation and its source block by block: its `PairRow`s. */
function PairRows({ children }: { children?: React.ReactNode }) {
	return <CompareRows>{children}</CompareRows>;
}

/**
 * One row of `PairRows`. `kind` `head` is the row of the two sides' names (`source` and `translation` are its words), `title` the two titles (from the
 * data); any other row is one block: its `name` (and `sub`, what is in it), a `note` when its source moved, `current` while it is written, and the
 * two sides' text from the data (`changed` source words are marked; an `untranslated` translation is the source, faint). `shared` is the translation
 * of a block both languages use, with the button (`sharedAction`) that makes a copy for this language.
 */
function PairRow({
	kind,
	name,
	sub,
	note,
	current,
	sourceLabel,
	translationLabel,
	source,
	translation,
	shared,
	sharedAction,
}: {
	kind?: "head" | "title" | "block";
	name?: string;
	sub?: string;
	note?: string;
	current?: boolean;
	sourceLabel?: string;
	translationLabel?: string;
	source?: Pieces;
	translation?: Pieces;
	shared?: boolean;
	sharedAction?: string;
}) {
	const side = (pieces: Pieces | undefined, source: boolean) =>
		kind === "title" ? (
			<Heading as="h2" variant="page">
				{pieces?.map((piece) => piece.text).join("")}
			</Heading>
		) : (
			// A row's side holds one block: nothing below its last line but the row's own padding.
			<CompareBody className="*:last:mb-0">{docBlocks(pieces, source)}</CompareBody>
		);
	return (
		<CompareRow
			head={kind === "head"}
			title={kind === "title"}
			current={current}
			name={
				sub ? (
					<>
						{name}
						<span className="block text-monti-faint">{sub}</span>
					</>
				) : (
					name
				)
			}
			note={note}
			source={kind === "head" ? sourceLabel : side(source, true)}
			translation={
				kind === "head" ? (
					translationLabel
				) : shared ? (
					<CompareShared action={<TextButton variant="underline">{sharedAction}</TextButton>}>
						{side(translation, false)}
					</CompareShared>
				) : (
					side(translation, false)
				)
			}
		/>
	);
}

/** The line under a pane's tabs (the source view's switch), as tall as a pane bar with a line under it. */
function PaneLine({ children }: { children?: React.ReactNode }) {
	return (
		<Inline minHeight="panebar" gap={8} border="bottom" paddingX={12} shrink={false}>
			{children}
		</Inline>
	);
}

/** Two versions of one entry side by side: its two `CompareColumn`s. */
function CompareView({ children }: { children?: React.ReactNode }) {
	return <Compare>{children}</Compare>;
}

/**
 * One version: its `label`, the properties that differ (`properties`: each one's `label` and its `text` pieces, from the data; `empty` names an
 * empty one), and the entry (`title` and `doc`, from the data) the way it reads.
 */
function CompareColumn({
	label,
	empty,
	properties,
	title,
	doc,
}: {
	label?: string;
	empty?: string;
	properties?: readonly { label: string; text?: string; changed?: boolean }[];
	title?: string;
	doc?: Pieces;
}) {
	return (
		<CompareSide
			label={label ?? ""}
			properties={properties?.map((property) => (
				<CompareProperty key={property.label} label={property.label} empty={empty ?? ""}>
					{property.text ? <CompareText changed={property.changed}>{property.text}</CompareText> : undefined}
				</CompareProperty>
			))}
		>
			<CompareTitle>{title}</CompareTitle>
			<CompareBody>
				{blocksOf(doc).map((block, index) =>
					block.kind === "h2" || block.kind === "h3" ? (
						<CompareHeading key={index}>{runOf(block.pieces)}</CompareHeading>
					) : (
						<CompareParagraph key={index}>{runOf(block.pieces)}</CompareParagraph>
					),
				)}
			</CompareBody>
		</CompareSide>
	);
}

/**
 * The pill over the status bar while the assistant's proposals wait: the request they came from (`name`, the admin's words from the data), which one
 * is looked at of how many, and discarding or taking them all.
 */
function ProposalDock({
	name,
	position,
	total,
	previousLabel,
	nextLabel,
	discardAllLabel,
	acceptAllLabel,
	besidePanel,
}: {
	name?: string;
	position?: number;
	total?: number;
	previousLabel?: string;
	nextLabel?: string;
	discardAllLabel?: string;
	acceptAllLabel?: string;
	/** The properties panel is open at the right: the pill centres over the editor column, clear of it. */
	besidePanel?: boolean;
}) {
	const none = () => {};
	// Drawn over the screen, it takes no room: 12px over the status bar, centred over the editor column, where the editor's dock holds it.
	return (
		<ProposalBubbleDock
			className={cn(
				"fixed bottom-[calc(var(--monti-height-statusbar)+12px)] left-0",
				besidePanel ? "right-(--monti-width-panel)" : "right-0",
			)}
		>
			<ProposalBubble
				name={name ?? ""}
				position={position ?? 1}
				total={total ?? 1}
				previousLabel={previousLabel ?? ""}
				nextLabel={nextLabel ?? ""}
				onPrevious={none}
				onNext={none}
				discardAllLabel={discardAllLabel ?? ""}
				onDiscardAll={none}
				acceptAllLabel={acceptAllLabel ?? ""}
				onAcceptAll={none}
			/>
		</ProposalBubbleDock>
	);
}

/**
 * The library as a picker, open over the screen (an image to insert): its `title`, the folders at the left (from the data: each one's `id`, `name`,
 * `depth` and `count`; `folder` the picked one), the search box, the files (`MediaTile`s) and the buttons.
 */
function PickerDialog({
	title,
	allLabel,
	folders,
	folder,
	foldersLabel,
	searchLabel,
	uploadLabel,
	confirmLabel,
	children,
}: {
	title?: string;
	allLabel?: string;
	folders?: readonly { id: string; name: string; depth: number; count?: number }[];
	folder?: string;
	foldersLabel?: string;
	searchLabel?: string;
	uploadLabel?: string;
	confirmLabel?: string;
	children?: React.ReactNode;
}) {
	const none = () => {};
	return (
		<MediaPicker
			open
			onOpenChange={none}
			title={title ?? ""}
			allLabel={allLabel ?? ""}
			folders={folders ?? []}
			folder={folder ?? null}
			onFolderChange={none}
			foldersLabel={foldersLabel ?? ""}
			search=""
			onSearchChange={none}
			searchLabel={searchLabel ?? ""}
			uploadLabel={uploadLabel ?? ""}
			onUpload={none}
			confirmLabel={confirmLabel ?? ""}
			onConfirm={none}
		>
			{children}
		</MediaPicker>
	);
}

/** What an empty list says first: its `title`, and the quiet question under it (`description`); its steps follow it. */
function EmptyHead({ title, description }: { title?: string; description?: string }) {
	// The room around it is the screen's (its Spacings), so the part's own is taken off.
	return <Empty title={title} description={description} className="pt-0 *:data-[slot=empty-description]:mb-0" />;
}

/** The editor's properties pane: its tabs (from the data: each one's `value` and `label`; `open` the picked one) over the picked tab's groups. */
function PropsPanel({
	label,
	open,
	tabs,
	children,
}: {
	label?: string;
	open?: string;
	tabs?: readonly { value: string; label: string; dot?: "warning" | "proposal" }[];
	children?: React.ReactNode;
}) {
	return (
		<PropertyPanel label={label ?? ""} value={open ?? ""} onValueChange={() => {}} tabs={tabs ?? []}>
			{children}
		</PropertyPanel>
	);
}

/** A run of property rows, with its quiet subheading (`title`) when it has one. */
function PropsGroup({ title, children }: { title?: string; children?: React.ReactNode }) {
	return <PropertyGroup title={title}>{children}</PropertyGroup>;
}

/** A property's label with the assistant's fill action at the end of its row (`action`, its words; ✦ is the part's). */
function LabelWithFill({ label, action, for: field }: { label?: string; action?: string; for?: string }) {
	return (
		<FormFieldLabelPart
			htmlFor={field}
			action={
				action ? (
					<TextButton tone="proposal" size="micro">
						{action}
					</TextButton>
				) : undefined
			}
		>
			{label}
		</FormFieldLabelPart>
	);
}

/** A field with a small button at the end of its line (make the address again from the title, open the category list). */
function LineInput({
	id,
	value,
	placeholder,
	mono,
	multiline,
	actionLabel,
	actionIcon,
	proposal,
}: {
	id?: string;
	value?: string;
	placeholder?: string;
	mono?: boolean;
	/** Several lines (a summary). */
	multiline?: boolean;
	actionLabel?: string;
	actionIcon?: IconName;
	/** The assistant wrote the value and nobody has touched it. */
	proposal?: boolean;
}) {
	const action = actionLabel ? (
		<IconButton label={actionLabel}>{actionIcon ? <Icon name={actionIcon} /> : null}</IconButton>
	) : undefined;
	return multiline ? (
		<TextareaPart
			id={id}
			defaultValue={value}
			placeholder={placeholder}
			mono={mono}
			action={action}
			proposal={proposal}
		/>
	) : (
		<InputPart id={id} defaultValue={value} placeholder={placeholder} mono={mono} action={action} proposal={proposal} />
	);
}

/** Values picked as chips in one line (an entry's tags), from the data; `removeLabel` names each chip's ×. */
function ChipsField({
	label,
	items,
	removeLabel,
}: {
	label?: string;
	items?: readonly { label: string }[];
	removeLabel?: string;
}) {
	return (
		<TagInput
			aria-label={label}
			items={(items ?? []).map((item) => item.label)}
			onChange={() => {}}
			removeLabel={(item) => `${item} ${removeLabel ?? ""}`.trim()}
		/>
	);
}

/** The picture of a property (an entry's cover), from the data, under its label. */
function PropertyPicture({ picture }: { picture?: string }) {
	const address = picture && /^(https?:|\/|data:)/.test(picture) ? picture : undefined;
	if (address || !picture) return <ImagePart src={address ?? ""} alt="" ratio="photo" radius="sm" />;
	return (
		<BoxPart radius="sm" className="aspect-[3/1] overflow-hidden">
			<SamplePicture paint={picture} />
		</BoxPart>
	);
}

/** A sample's picture: the paint a board draws where a real file's picture goes (a gradient), so a sample screen reads like the board. */
function SamplePicture({ paint }: { paint: string }) {
	return (
		<span data-slot="sample-picture" aria-hidden="true" className="block size-full" style={{ background: paint }} />
	);
}

/** The assistant's empty panel: the requests to start from, in groups under their `SuggestHeading`s. */
function Suggestions({ children }: { children?: React.ReactNode }) {
	return <SuggestList>{children}</SuggestList>;
}

/** The name of a group of requests ("In this list", "Recent"). */
function SuggestHeading({ text }: { text?: string }) {
	return <SuggestLabel>{text}</SuggestLabel>;
}

/** One request to start from: `recent` for one asked before; otherwise a saved one. */
function SuggestRow({ label, recent }: { label?: string; recent?: boolean }) {
	return <Suggest kind={recent ? "recent" : "request"}>{label}</Suggest>;
}

/**
 * The box a conversation is typed in: its name (`label`), the line it shows while empty, the send button's name, and at its start the model it asks
 * (`model`, with how hard it thinks, `effort`).
 */
function ChatBox({
	label,
	placeholder,
	sendLabel,
	modelLabel,
	model,
	effort,
}: {
	label?: string;
	placeholder?: string;
	sendLabel?: string;
	modelLabel?: string;
	model?: string;
	effort?: string;
}) {
	const none = () => {};
	return (
		<ChatInput
			value=""
			onValueChange={none}
			onSubmit={none}
			onStop={none}
			label={label ?? ""}
			placeholder={placeholder}
			sendLabel={sendLabel ?? ""}
			stopLabel=""
			aside={
				<TextButton mono size="caption" aria-label={modelLabel}>
					{model}
					{effort && <Text tone="faint"> · {effort}</Text>}
					<Caret />
				</TextButton>
			}
		/>
	);
}

/**
 * A conversation with the assistant, from the data: each turn's `role` (`user` asked, `tool` a call it made, `assistant` its words, `entry` an entry its
 * answer names, with its slug as `detail`) and `text`. The proposals it made (`ProposalBox`) follow it.
 */
function Conversation({
	turns,
	children,
}: {
	turns?: readonly { role: string; text: string; detail?: string }[];
	children?: React.ReactNode;
}) {
	// The turns of one answer (its calls, its words, the entries it names) go together.
	const groups: { role: string; turns: { role: string; text: string; detail?: string }[] }[] = [];
	for (const turn of turns ?? []) {
		const last = groups[groups.length - 1];
		if (turn.role === "user" || !last || last.role === "user")
			groups.push({ role: turn.role === "user" ? "user" : "answer", turns: [turn] });
		else last.turns.push(turn);
	}
	return (
		<ChatThread>
			{groups.map((group, index) =>
				group.role === "user" ? (
					<ChatMessage key={index} author="user">
						{group.turns[0]?.text}
					</ChatMessage>
				) : (
					<ChatAnswer key={index}>
						{group.turns.some((turn) => turn.role === "tool") && (
							<ToolCallLines>
								{group.turns
									.filter((turn) => turn.role === "tool")
									.map((turn) => (
										<ToolCallLine key={turn.text} status="done" statusLabel="">
											{turn.text}
										</ToolCallLine>
									))}
							</ToolCallLines>
						)}
						{group.turns
							.filter((turn) => turn.role === "assistant")
							.map((turn) => (
								<ChatMessage key={turn.text} author="assistant">
									{turn.text}
								</ChatMessage>
							))}
						{group.turns.some((turn) => turn.role === "entry") && (
							<ChatEntryList>
								{group.turns
									.filter((turn) => turn.role === "entry")
									.map((turn) => (
										<ChatEntryLink key={turn.text} slug={turn.detail}>
											{turn.text}
										</ChatEntryLink>
									))}
							</ChatEntryList>
						)}
					</ChatAnswer>
				),
			)}
			{children}
		</ChatThread>
	);
}

/**
 * A proposal in the conversation: what it is (`title`) and how much (`summary`), where it stands (`status`), the entries it changes (from the data:
 * each one's `name`, `slug`, `field` and new `text`), and its foot (review, discard, apply).
 */
function ProposalBox({
	title,
	summary,
	status,
	entries,
	reviewLabel,
	discardLabel,
	applyLabel,
}: {
	title?: string;
	summary?: string;
	status?: string;
	entries?: readonly { name: string; slug?: string; field?: string; text: string }[];
	reviewLabel?: string;
	discardLabel?: string;
	applyLabel?: string;
}) {
	const none = () => {};
	return (
		<ProposalCard
			title={title}
			summary={summary}
			status={status}
			statusTone="warning"
			footer={
				<ProposalActions
					reviewLabel={reviewLabel}
					onReview={reviewLabel ? none : undefined}
					discardLabel={discardLabel ?? ""}
					onDiscard={none}
					applyLabel={applyLabel ?? ""}
					onApply={none}
				/>
			}
		>
			{entries?.map((entry) => (
				<ProposalEntry key={entry.name} name={entry.name} slug={entry.slug} field={entry.field} after={entry.text} />
			))}
		</ProposalCard>
	);
}

/** The words of a list section's head (its name, its count): each one a piece of the section's own head line, set apart as it sets them. */
function SectionHead({ children }: { children?: React.ReactNode }) {
	return <>{children}</>;
}

export const SCREEN = { spacing: [2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48], group: "Stack", words: "Words" };

/**
 * The parts a screen spec can name, by the name it uses. `pnpm gen:screen-catalog` reads their prop types into `catalog.generated.json`, which
 * `checkSpec` checks a spec against; add a part here and run it.
 */
export const parts = {
	Box,
	SectionHead,
	Conversation,
	ProposalBox,
	Suggestions,
	SuggestHeading,
	SuggestRow,
	ChatBox,
	PropsPanel,
	PropsGroup,
	LabelWithFill,
	LineInput,
	ChipsField,
	PropertyPicture,
	EmptyHead,
	PickerDialog,
	ProposalDock,
	CompareView,
	CompareColumn,
	PairRows,
	PairRow,
	PaneLine,
	EditorTopBar,
	PublishButton,
	EntryTitle,
	TitleInput,
	TitleRule,
	EditorBody,
	SourceColumn,
	LanguageBar,
	EditorStatusBar,
	StatusCell,
	StatusGap,
	StatusListCell,
	ReviewAsk,
	ReviewHead,
	ReviewEntry,
	ReviewBlockLine,
	ReviewBlockCompare,
	ReviewColumns,
	ReviewRest,
	Trail,
	TrailSlash,
	DropZone,
	MediaGrid,
	MediaTile,
	FolderEntry,
	KindList,
	KindItem,
	PaneTabs,
	PaneTab,
	SegmentedChoice,
	Choices,
	Choice,
	Change,
	ChangeResult,
	ChangeRows,
	ChangeRow,
	Sheet,
	SheetBody,
	SheetSplit,
	SheetSummary,
	Folder,
	FolderTabRow,
	FolderTabItem,
	FolderBody,
	FieldTree,
	FieldLine,
	GridBox,
	RailAdd,
	ReadValue,
	Was,
	DangerSection,
	DangerLine,
	Lock,
	Rail,
	NavEntry,
	OptionSwitch,
	Panel,
	IconOnlyButton,
	DragHandle,
	LanguageList,
	LanguageLine,
	LanguageSourceMark,
	ListSection,
	ListSectionRows,
	ListSectionRow,
	Textarea,
	SaveGroup,
	ChangedLabel,
	TwoLineCell,
	SelectBox,
	Filter,
	Banner,
	AffixField,
	VerticalRule,
	Section,
	OptionCheck,
	ListBody,
	TwoLineTitleCell,
	TrashTitleCell,
	TrashDateCell,
	RowButtonsCell,
	MoreButton,
	AssistantCorner,
	PageToolbar,
	PageToolbarEnd,
	TabLinks,
	LanguageTabs,
	SiteName,
	Words,
	TabAdd,
	Tab,
	List,
	TitleCell,
	CountCell,
	ActionsCell,
	LinkCell,
	RowMark,
	PageSize,
	Pager,
	PageButton,
	EmptySteps,
	EmptyStep,
	ChangeDot,
	Sidebar,
	SidebarHeader,
	SidebarRailToggle,
	SidebarNav,
	SidebarItem,
	SidebarCount,
	SidebarSub,
	SidebarSubItem,
	SidebarFoot,
	SidebarScreenMode,
	Stack,
	Form,
	Heading,
	Text,
	FormField,
	FormFieldLabel,
	Input,
	FormFieldError,
	Button,
	Separator,
	Image,
	Icon,
	PageColumn,
	PageHeader,
	TextButton,
	ListHead,
	ListScroll,
	Table,
	TableBody,
	TableRow,
	TableCell,
	RowCheck,
	RowLink,
	RowTitle,
	RowActions,
	EntryStatus,
	Count,
	IconButton,
	SearchToggle,
	ListFooter,
	PageSizeMenu,
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationPrevious,
	PaginationNext,
};

/**
 * What a spec may write on each entry, and who decides it. An entry is a `part` (its look is the design system's) or a `layout` (a container the screen
 * arranges with). Each prop has a kind; a prop with no kind here cannot be written in a spec, whatever its TypeScript type has (default deny). Adding a
 * prop is deciding its kind, which says whether the design system or the screen decides it:
 *
 * - `variant`: a choice among the part's looks (a union of literals). The design system decides.
 * - `flag`: an on/off of the part (a boolean).
 * - `layout`: how a layout container arranges (direction, alignment, growing). Only on `layout` entries. The screen decides.
 * - `layout-number`: a region's size in px (`maxWidth`). Only on `layout` entries; the catalog will not build with one on a part. Never a distance:
 *   a distance is a `Spacing` item.
 * - `event`: a handler, wired later by the element's id. A spec never writes one.
 * - `data`: a list or an object only the data gives, with the fields each item may have (`data:id,label`). What a screen shows, never a look.
 * - `text`: words the screen shows (a label, a placeholder): only `{ "text": key }`, `{ "template": key, "values": … }` or `{ "state": pointer }`.
 * - `ref`: another element of the spec (`@emailInput`), for a label's field; the real ids are made when drawn.
 * - `state`: a value only the state gives (a picture's address).
 * - `action`: a thing the screen does, by name (`{ "action": "signIn" }`).
 *
 * `role` says what the renderer does for an entry beyond drawing it: a `form` makes a `button` inside it its submit.
 *
 * `bind: "yes"` lets an entry take an element `bind` (`/form/email`): the data the field holds and sends. No raw HTML attribute (an id, an input's name, an
 * address) is ever written in a spec.
 */
export const CATALOG = {
	Stack: {
		kind: "layout",
		props: {
			direction: "layout",
			align: "layout",
			justify: "layout",
			grow: "layout",
			wrap: "layout",
			minHeight: "layout",
			width: "layout-number",
			maxWidth: "layout-number",
			minWidth: "layout-number",
		},
	},
	Box: { kind: "part", props: { border: "variant" } },
	SectionHead: { kind: "part", props: {} },
	Conversation: { kind: "part", props: { turns: "data:role,text,detail" } },
	ProposalBox: {
		kind: "part",
		props: {
			title: "text",
			summary: "text",
			status: "state",
			entries: "data:name,slug,field,text",
			reviewLabel: "text",
			discardLabel: "text",
			applyLabel: "text",
		},
	},
	Suggestions: { kind: "part", props: {} },
	SuggestHeading: { kind: "part", props: { text: "text" } },
	SuggestRow: { kind: "part", props: { label: "text", recent: "flag" } },
	ChatBox: {
		kind: "part",
		props: {
			label: "text",
			placeholder: "text",
			sendLabel: "text",
			modelLabel: "text",
			model: "state",
			effort: "text",
		},
	},
	PropsPanel: { kind: "part", props: { label: "text", open: "text", tabs: "data:value,label,dot" } },
	PropsGroup: { kind: "part", props: { title: "text" } },
	LabelWithFill: { kind: "part", props: { label: "text", action: "text", for: "ref" } },
	LineInput: {
		kind: "part",
		bind: "yes",
		props: {
			id: "text",
			value: "state",
			placeholder: "text",
			mono: "flag",
			multiline: "flag",
			actionLabel: "text",
			actionIcon: "variant",
			proposal: "flag",
		},
	},
	ChipsField: { kind: "part", props: { label: "text", items: "data:label", removeLabel: "text" } },
	PropertyPicture: { kind: "part", props: { picture: "state" } },
	EmptyHead: { kind: "part", props: { title: "text", description: "text" } },
	PickerDialog: {
		kind: "overlay",
		props: {
			title: "text",
			allLabel: "text",
			folders: "data:id,name,depth,count",
			folder: "state",
			foldersLabel: "text",
			searchLabel: "text",
			uploadLabel: "text",
			confirmLabel: "text",
		},
	},
	ProposalDock: {
		kind: "overlay",
		props: {
			name: "state",
			position: "state",
			total: "state",
			previousLabel: "text",
			nextLabel: "text",
			discardAllLabel: "text",
			acceptAllLabel: "text",
			besidePanel: "flag",
		},
	},
	CompareView: { kind: "part", props: {} },
	PairRows: { kind: "part", props: {} },
	PaneLine: { kind: "part", props: {} },
	PairRow: {
		kind: "part",
		props: {
			kind: "variant",
			name: "text",
			sub: "text",
			note: "text",
			current: "flag",
			sourceLabel: "text",
			translationLabel: "text",
			source: "data:kind,text,changed,faint,picture,label,placeholder,editable",
			translation: "data:kind,text,changed,faint,picture,label,placeholder,editable",
			shared: "flag",
			sharedAction: "text",
		},
	},
	CompareColumn: {
		kind: "part",
		props: {
			label: "text",
			empty: "text",
			properties: "data:label,text,changed",
			title: "state",
			doc: "data:kind,text,changed",
		},
	},
	EditorTopBar: { kind: "part", props: {} },
	PublishButton: { kind: "part", props: { label: "text", menuLabel: "text" } },
	EntryTitle: { kind: "part", props: { text: "state", faint: "flag", untranslated: "flag" } },
	TitleRule: { kind: "part", props: {} },
	TitleInput: { kind: "part", bind: "yes", props: { id: "text", value: "state", placeholder: "text", label: "text" } },
	EditorBody: {
		kind: "part",
		props: {
			doc: "data:kind,text,mark,untranslated,active,current,gap,muted",
			tools: "data:kind,block,x,y,width,on,text,key,discard,accept,row,icon,sub,label",
			muted: "flag",
		},
	},
	SourceColumn: { kind: "part", props: { label: "text", title: "state" } },
	LanguageBar: { kind: "part", props: {} },
	EditorStatusBar: { kind: "part", props: { label: "text" } },
	StatusCell: { kind: "part", props: { label: "text", tone: "variant", noDot: "flag", end: "flag" } },
	StatusGap: { kind: "part", props: {} },
	StatusListCell: {
		kind: "part",
		props: {
			label: "text",
			tone: "variant",
			listLabel: "text",
			count: "state",
			items: "data:title,detail,action,ai,current",
			done: "data:text",
		},
	},
	ReviewAsk: { kind: "part", props: { text: "state" } },
	ReviewHead: { kind: "part", props: { title: "text", meta: "text" } },
	ReviewEntry: {
		kind: "part",
		props: {
			title: "state",
			path: "state",
			end: "text",
			again: "text",
			change: "data:kind,text",
			included: "flag",
			muted: "flag",
			endWarning: "flag",
		},
	},
	ReviewBlockLine: { kind: "part", props: { label: "text", note: "text", text: "data:kind,text", included: "flag" } },
	ReviewBlockCompare: {
		kind: "part",
		props: { label: "text", note: "text", before: "data:kind,text", after: "data:kind,text", included: "flag" },
	},
	ReviewColumns: { kind: "part", props: { before: "text", after: "text" } },
	ReviewRest: { kind: "part", props: { label: "text" } },
	Trail: { kind: "part", props: { label: "text" } },
	TrailSlash: { kind: "part", props: {} },
	DropZone: { kind: "part", props: { over: "flag" } },
	MediaGrid: { kind: "part", props: { folders: "flag" } },
	MediaTile: {
		kind: "part",
		props: {
			name: "text",
			detail: "text",
			picture: "state",
			ext: "text",
			status: "variant",
			progress: "state",
			actions: "data:label",
			selected: "flag",
			picking: "flag",
		},
	},
	FolderEntry: { kind: "part", props: { name: "text", count: "state", up: "flag", selected: "flag" } },
	KindList: { kind: "part", props: { label: "text" } },
	KindItem: { kind: "part", props: { label: "text", selected: "flag", mark: "text" } },
	PaneTabs: { kind: "part", props: { open: "text" } },
	PaneTab: { kind: "part", props: { label: "text" } },
	SegmentedChoice: {
		kind: "part",
		props: { label: "text", options: "data:value,label", picked: "text", size: "variant", inline: "flag" },
	},
	Choices: { kind: "part", props: { label: "text", picked: "text" } },
	Choice: { kind: "part", props: { label: "text", description: "text", hint: "text" } },
	Change: { kind: "part", props: { kind: "variant", tag: "text", title: "text", identifier: "text" } },
	ChangeResult: { kind: "part", props: { text: "text", danger: "flag" } },
	ChangeRows: { kind: "part", props: {} },
	ChangeRow: { kind: "part", props: { what: "text", result: "text" } },
	Sheet: { kind: "overlay", props: { title: "text", of: "text" } },
	SheetBody: { kind: "part", props: { blocks: "flag" } },
	SheetSplit: { kind: "part", props: {} },
	SheetSummary: { kind: "part", props: { text: "text" } },
	Folder: { kind: "part", props: { open: "text" } },
	FolderTabRow: { kind: "part", props: { add: "text" } },
	FolderTabItem: { kind: "part", props: { label: "text", count: "text", locked: "flag", fixed: "flag" } },
	FolderBody: { kind: "part", props: {} },
	FieldTree: { kind: "part", props: {} },
	FieldLine: {
		kind: "part",
		props: {
			name: "text",
			label: "text",
			description: "text",
			note: "text",
			kind: "text",
			depth: "variant",
			group: "flag",
			tone: "variant",
			locked: "text",
			fixed: "flag",
		},
	},
	GridBox: { kind: "part", props: { columns: "variant" } },
	RailAdd: { kind: "part", props: { label: "text" } },
	ReadValue: { kind: "part", props: { label: "text", mono: "flag" } },
	Was: { kind: "part", props: { text: "text" } },
	DangerSection: { kind: "part", props: { title: "text" } },
	DangerLine: { kind: "part", props: { name: "text", meta: "text" } },
	Lock: { kind: "part", props: { label: "text" } },
	Rail: { kind: "part", props: { label: "text" } },
	NavEntry: { kind: "part", props: { label: "text", note: "text", active: "flag", dot: "text" } },
	OptionSwitch: { kind: "part", props: { label: "text", checked: "flag" } },
	Panel: { kind: "part", props: { title: "text", closable: "flag", width: "variant", bleed: "flag" } },
	IconOnlyButton: { kind: "part", props: { icon: "variant", label: "text" } },
	DragHandle: { kind: "part", props: { "aria-label": "text" } },
	LanguageList: { kind: "part", props: {} },
	LanguageLine: {
		kind: "part",
		props: {
			name: "text",
			code: "text",
			label: "text",
			dot: "text",
			gone: "flag",
			handle: "flag",
			handled: "flag",
			handleLabel: "text",
		},
	},
	LanguageSourceMark: { kind: "part", props: { flag: "text" } },
	ListSection: { kind: "part", props: { count: "text", countTone: "variant" } },
	ListSectionRows: { kind: "part", props: {} },
	ListSectionRow: { kind: "part", props: { metaTone: "variant", muted: "flag" } },
	Textarea: { kind: "part", bind: "yes", props: { rows: "state", mono: "flag", value: "state" } },
	SaveGroup: {
		kind: "part",
		props: {
			label: "text",
			count: "state",
			discardLabel: "text",
			saveLabel: "text",
			saveDisabled: "flag",
			proposalsLabel: "text",
			proposalsCount: "state",
		},
	},
	ChangedLabel: { kind: "part", props: { label: "text", undo: "text", proposal: "flag", for: "ref" } },
	TwoLineCell: { kind: "part", props: { title: "text", sub: "text", proposal: "flag" } },
	SelectBox: {
		kind: "part",
		props: { value: "text", size: "variant", width: "variant", proposal: "flag", warning: "flag" },
	},
	Filter: { kind: "part", props: { label: "text", filled: "flag" } },
	Banner: { kind: "part", props: { title: "text", meta: "text", tone: "variant" } },
	AffixField: {
		kind: "part",
		props: { value: "state", prefix: "text", suffix: "text", placeholder: "text", proposal: "flag" },
	},
	VerticalRule: { kind: "part", props: {} },
	Section: { kind: "part", props: { stacked: "flag", last: "flag", dense: "flag" } },
	OptionCheck: {
		kind: "part",
		props: { label: "text", note: "text", checked: "flag", mono: "flag", noteTone: "variant" },
	},
	ListBody: { kind: "part", props: {} },
	TwoLineTitleCell: { kind: "part", props: { title: "text", note: "text" } },
	TrashTitleCell: {
		kind: "part",
		props: { title: "text", address: "text", meta: "text", folder: "flag", metaTone: "variant" },
	},
	TrashDateCell: { kind: "part", props: { date: "text", left: "text", urgent: "flag" } },
	RowButtonsCell: { kind: "part", props: {} },
	MoreButton: { kind: "part", props: { label: "text", letter: "flag" } },
	AssistantCorner: { kind: "overlay", props: { label: "text" } },
	PageToolbar: { kind: "part", props: { inset: "flag" } },
	PageToolbarEnd: { kind: "part", props: {} },
	TabLinks: { kind: "part", props: { variant: "variant" } },
	Tab: { kind: "part", props: { label: "text", current: "flag", count: "text", countTone: "variant", dot: "variant" } },
	List: { kind: "part", props: {} },
	TitleCell: { kind: "part", props: { title: "text", address: "text", folder: "flag" } },
	CountCell: { kind: "part", props: { align: "variant", tone: "variant" } },
	ActionsCell: { kind: "part", props: { label: "text" } },
	RowMark: { kind: "part", props: { checked: "flag", label: "text" } },
	PageSize: { kind: "part", props: { shown: "text", label: "text" } },
	Pager: { kind: "part", props: {} },
	PageButton: { kind: "part", props: { step: "variant", current: "flag", off: "flag", page: "text" } },
	EmptySteps: { kind: "part", props: {} },
	EmptyStep: { kind: "part", props: { number: "text", title: "text" } },
	ChangeDot: { kind: "part", props: { tone: "variant", label: "text" } },
	Sidebar: { kind: "part", props: { rail: "flag", label: "text" } },
	SidebarHeader: { kind: "part", props: {} },
	SidebarRailToggle: { kind: "part", props: {} },
	SidebarNav: { kind: "part", props: { place: "variant" } },
	SidebarItem: { kind: "part", props: { active: "flag" } },
	SidebarCount: { kind: "part", props: { tone: "variant" } },
	SidebarSub: { kind: "part", props: {} },
	SidebarSubItem: { kind: "part", props: { active: "flag", depth: "variant" } },
	SidebarFoot: { kind: "part", props: {} },
	SidebarScreenMode: {
		kind: "part",
		props: { value: "variant", label: "text", system: "text", light: "text", dark: "text", defaultOpen: "flag" },
	},
	Form: { kind: "part", role: "form", props: { action: "action" } },
	Heading: { kind: "part", props: { as: "variant", variant: "variant", tone: "variant", truncate: "flag" } },
	Text: {
		kind: "part",
		props: {
			as: "variant",
			variant: "variant",
			tone: "variant",
			weight: "variant",
			align: "variant",
			lines: "variant",
			mono: "flag",
			truncate: "flag",
		},
	},
	FormField: { kind: "part", props: {} },
	FormFieldLabel: { kind: "part", props: { for: "ref" } },
	Input: {
		kind: "part",
		bind: "yes",
		props: {
			value: "state",
			type: "variant",
			placeholder: "text",
			size: "variant",
			width: "variant",
			mono: "flag",
			autofill: "variant",
			required: "flag",
			invalid: "flag",
		},
	},
	FormFieldError: { kind: "part", props: {} },
	Button: {
		kind: "part",
		role: "button",
		props: { variant: "variant", size: "variant", width: "variant", disabled: "flag", loading: "flag" },
	},
	Separator: { kind: "part", props: { label: "text", length: "variant" } },
	Image: { kind: "part", props: { src: "state", size: "variant", radius: "variant", fit: "variant" } },
	Icon: { kind: "part", props: { name: "variant" } },
	PageColumn: { kind: "part", props: { width: "variant" } },
	PageHeader: { kind: "part", props: {} },
	TextButton: { kind: "part", props: { variant: "variant", size: "variant", tone: "variant" } },
	LanguageTabs: { kind: "part", props: { label: "text" } },
	SiteName: { kind: "part", props: { name: "state" } },
	Words: { kind: "part", props: {} },
	TabAdd: { kind: "part", props: { label: "text" } },
	ListHead: {
		kind: "part",
		props: {
			columns: "data:id,label,sort,filtered,size,align",
			addLabel: "text",
			end: "state",
			moveLabel: "text",
			onPlace: "event",
			onStep: "event",
			onPreview: "event",
		},
	},
	ListScroll: { kind: "part", props: {} },
	Table: { kind: "part", props: { container: "variant", layout: "variant" } },
	TableBody: { kind: "part", props: { dimmed: "flag" } },
	TableRow: { kind: "part", props: { selected: "flag", proposal: "flag", twoLine: "flag" } },
	LinkCell: { kind: "part", props: { label: "state", underline: "flag" } },
	TableCell: { kind: "part", props: { align: "variant", tone: "variant", width: "variant", truncate: "flag" } },
	RowCheck: { kind: "part", props: { checked: "flag", proposal: "flag", label: "text", onCheckedChange: "event" } },
	RowLink: { kind: "part", props: {} },
	RowTitle: { kind: "part", props: { folder: "flag" } },
	RowActions: { kind: "part", props: {} },
	EntryStatus: { kind: "part", props: { status: "variant", quiet: "flag" } },
	Count: { kind: "part", props: { tone: "variant" } },
	IconButton: { kind: "part", props: { tone: "variant", label: "text" } },
	SearchToggle: {
		kind: "part",
		bind: "yes",
		props: {
			label: "text",
			"aria-label": "text",
			placeholder: "text",
			targets: "data:value,label",
			onValueChange: "event",
			onTargetChange: "event",
		},
	},
	ListFooter: { kind: "part", props: {} },
	PageSizeMenu: {
		kind: "part",
		bind: "yes",
		props: { label: "text", options: "data:value,label", onValueChange: "event" },
	},
	Pagination: { kind: "part", props: {} },
	PaginationContent: { kind: "part", props: {} },
	PaginationItem: { kind: "part", props: {} },
	PaginationLink: { kind: "part", props: { isActive: "flag", disabled: "flag" } },
	PaginationPrevious: { kind: "part", props: { disabled: "flag" } },
	PaginationNext: { kind: "part", props: { disabled: "flag" } },
};
