import * as React from "react";
import { Affix } from "../affix";
import { Banner as BannerPart } from "../banner";
import { Box as BoxPart } from "../box";
import { Button } from "../button";
import { ChangeDot } from "../change-dot";
import { ChangesBar } from "../changes-group";
import { Checkbox } from "../checkbox";
import { Count } from "../count";
import { DangerBlock, DangerRow } from "../danger-block";
import { DragHandle } from "../drag-handle";
import { EmptyStep as EmptyStepPart, EmptySteps } from "../empty";
import { EntryStatus } from "../entry-status";
import { FormField, FormFieldError, FormFieldLabel as FormFieldLabelPart, FormFieldWas } from "../field";
import { FieldRow, FieldTree as FieldTreePart } from "../field-tree";
import { FilterButton } from "../filter-button";
import { FolderTab, FolderTabs, FolderTabsAdd, FolderTabsBody, FolderTabsList } from "../folder-tabs";
import { Grid } from "../grid";
import { IconButton } from "../icon-button";
import { type IconName, iconsByName } from "../icons";
import { Image as ImagePart } from "../image";
import { Input as InputPart } from "../input";
import { LanguageRow, LanguageSource } from "../language-row";
import { ListHead } from "../list-head";
import { ListSection as ListSectionPart, ListSectionRow } from "../list-section";
import { LockMark } from "../lock-mark";
import { NavLink } from "../nav-link";
import { Option } from "../option";
import { PageColumn, PageHeader, PageToolbar } from "../page-header";
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
import { RailAction, RailLayout } from "../rail-layout";
import { ReadValue as ReadValuePart } from "../read-value";
import { SearchToggle as SearchTogglePart } from "../search-box";
import { Section } from "../section";
import { Select, SelectTrigger, SelectValue } from "../select";
import { Separator } from "../separator";
import {
	SheetBody as SheetBodyPart,
	SheetContent,
	SheetFooter,
	SheetHeader,
	Sheet as SheetRoot,
	SheetSplit as SheetSplitPart,
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
} from "../sidebar";
import { Inline, Stack as StackPart } from "../stack";
import { Switch } from "../switch";
import { ListScroll, RowActions, RowCheck, RowLink, RowTitle, Table, TableBody, TableCell, TableRow } from "../table";
import { TabLink, TabLinks } from "../tabs";
import { Heading, Text } from "../text";
import { TextButton } from "../text-button";
import { Textarea as TextareaPart } from "../textarea";
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
		<SidebarProvider rail={rail} className={className}>
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
	return (
		<SidebarMenuItem>
			<SidebarMenuButton isActive={active}>{children}</SidebarMenuButton>
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

/** One folder under a row: its name and its count. */
function SidebarSubItem({ active, children }: { active?: boolean; children?: React.ReactNode }) {
	return (
		<li>
			<SidebarMenuSubButton isActive={active}>{children}</SidebarMenuSubButton>
		</li>
	);
}

/** The screen mode in the foot: three cells, or (folded) one button that opens them, `defaultOpen` drawn open. */
function SidebarScreenMode({
	value = "system",
	label,
	defaultOpen,
}: {
	value?: "system" | "light" | "dark";
	label?: string;
	defaultOpen?: boolean;
}) {
	return (
		<SidebarScreenModePart
			value={value}
			defaultOpen={defaultOpen}
			labels={{ label: label ?? "", system: "", light: "", dark: "" }}
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

/** A list: its head row and its rows in one table, so the columns line up (a board draws them as two neighbours). */
function List({ children }: { children?: React.ReactNode }) {
	return <Table container="none">{children}</Table>;
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
function CountCell({ align, children }: { align?: "start" | "end"; children?: React.ReactNode }) {
	return (
		<TableCell align={align}>
			<Count>{children}</Count>
		</TableCell>
	);
}

/** The ⋯ at the end of a row. */
function ActionsCell({ label }: { label?: string }) {
	return (
		<TableCell align="end">
			<RowActions>
				<IconButton label={label ?? ""}>
					<Icon name="overflow-menu--horizontal" />
				</IconButton>
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

/** The ⋯ of a row: an icon button. */
function MoreButton({ label }: { label?: string }) {
	return (
		<IconButton label={label ?? ""}>
			<Icon name="overflow-menu--horizontal" />
		</IconButton>
	);
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
function OptionCheck({ label, note, checked }: { label?: string; note?: string; checked?: boolean }) {
	return (
		<Option>
			<Checkbox checked={checked ?? false} />
			{label}
			{note && (
				<Text variant="meta" tone="subtle">
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
}: {
	value?: string;
	size?: "sm" | "default";
	width?: "fit" | "full";
	/** The assistant picked the value and nobody has touched it. */
	proposal?: boolean;
}) {
	return (
		<Select items={[{ value: "shown", label: value ?? "" }]} value="shown">
			<SelectTrigger size={size} width={width} proposal={proposal}>
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
	prefix,
	suffix,
	placeholder,
	proposal,
}: {
	prefix?: string;
	suffix?: string;
	placeholder?: string;
	/** The assistant wrote what is typed and nobody has touched it. */
	proposal?: boolean;
}) {
	return <Affix prefix={prefix} suffix={suffix} placeholder={placeholder} proposal={proposal} />;
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
			<Text as="div" truncate>
				{proposal && (
					<Text tone="proposal">
						<Icon name="spark" />{" "}
					</Text>
				)}
				{title}
			</Text>
			<Text as="div" variant="meta" tone="subtle" truncate>
				{sub}
			</Text>
		</TableCell>
	);
}

/** The save group of a settings screen, as it looks: "changes N", "undo all", the pill. Its list and its actions are wired later. */
function SaveGroup({
	label,
	count,
	discardLabel,
	saveLabel,
	saveDisabled,
}: {
	label?: string;
	count?: number;
	discardLabel?: string;
	saveLabel?: string;
	saveDisabled?: boolean;
}) {
	return (
		<ChangesBar
			label={label ?? ""}
			count={Number(count ?? 0)}
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
	return <LanguageSource flag={flag}>{children}</LanguageSource>;
}

/** A panel beside the page: its title, its actions (⋯) and × in its head, what it holds, and its footer. */
function Panel({
	title,
	closable,
	width,
	actions,
	footer,
	children,
}: {
	title?: string;
	closable?: boolean;
	width?: "side" | "panel";
	actions?: React.ReactNode;
	footer?: React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<SidePanel title={title} closable={closable} width={width} actions={actions} footer={footer}>
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

/** Children in equal columns (a collection's editor options, three across). */
function GridBox({ columns, children }: { columns?: 1 | 2 | 3 | 4 | 6; children?: React.ReactNode }) {
	return <Grid columns={columns}>{children}</Grid>;
}

/** What cannot be undone, apart at the end of a page: its title in danger, its rows under it. */
function DangerSection({ title, children }: { title?: string; children?: React.ReactNode }) {
	return <DangerBlock title={title}>{children}</DangerBlock>;
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

export const SCREEN = { spacing: [2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48], group: "Stack" };

/**
 * The parts a screen spec can name, by the name it uses. `pnpm gen:screen-catalog` reads their prop types into `catalog.generated.json`, which
 * `checkSpec` checks a spec against; add a part here and run it.
 */
export const parts = {
	Box,
	Sheet,
	SheetBody,
	SheetSplit,
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
	PageToolbar,
	TabLinks,
	Tab,
	List,
	TitleCell,
	CountCell,
	ActionsCell,
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
	Sheet: { kind: "overlay", props: { title: "text", of: "text" } },
	SheetBody: { kind: "part", props: { blocks: "flag" } },
	SheetSplit: { kind: "part", props: {} },
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
	Panel: { kind: "part", props: { title: "text", closable: "flag", width: "variant" } },
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
	Textarea: { kind: "part", bind: "yes", props: { rows: "state", mono: "flag" } },
	SaveGroup: {
		kind: "part",
		props: { label: "text", count: "state", discardLabel: "text", saveLabel: "text", saveDisabled: "flag" },
	},
	ChangedLabel: { kind: "part", props: { label: "text", undo: "text", proposal: "flag", for: "ref" } },
	TwoLineCell: { kind: "part", props: { title: "text", sub: "text", proposal: "flag" } },
	SelectBox: { kind: "part", props: { value: "text", size: "variant", width: "variant", proposal: "flag" } },
	Filter: { kind: "part", props: { label: "text", filled: "flag" } },
	Banner: { kind: "part", props: { title: "text", meta: "text", tone: "variant" } },
	AffixField: { kind: "part", props: { prefix: "text", suffix: "text", placeholder: "text", proposal: "flag" } },
	VerticalRule: { kind: "part", props: {} },
	Section: { kind: "part", props: { stacked: "flag", last: "flag" } },
	OptionCheck: { kind: "part", props: { label: "text", note: "text", checked: "flag" } },
	ListBody: { kind: "part", props: {} },
	TwoLineTitleCell: { kind: "part", props: { title: "text", note: "text" } },
	TrashTitleCell: {
		kind: "part",
		props: { title: "text", address: "text", meta: "text", folder: "flag", metaTone: "variant" },
	},
	TrashDateCell: { kind: "part", props: { date: "text", left: "text", urgent: "flag" } },
	RowButtonsCell: { kind: "part", props: {} },
	MoreButton: { kind: "part", props: { label: "text" } },
	PageToolbar: { kind: "part", props: { inset: "flag" } },
	TabLinks: { kind: "part", props: { variant: "variant" } },
	Tab: { kind: "part", props: { label: "text", current: "flag", count: "text", countTone: "variant", dot: "variant" } },
	List: { kind: "part", props: {} },
	TitleCell: { kind: "part", props: { title: "text", address: "text", folder: "flag" } },
	CountCell: { kind: "part", props: { align: "variant" } },
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
	SidebarSubItem: { kind: "part", props: { active: "flag" } },
	SidebarFoot: { kind: "part", props: {} },
	SidebarScreenMode: { kind: "part", props: { value: "variant", label: "text", defaultOpen: "flag" } },
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
	ListHead: {
		kind: "part",
		props: {
			columns: "data:id,label,sort,filtered",
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
