import * as React from "react";
import { Affix } from "../affix";
import { Banner as BannerPart } from "../banner";
import { Box as BoxPart } from "../box";
import { Button } from "../button";
import { ChangeDot } from "../change-dot";
import { Checkbox } from "../checkbox";
import { Count } from "../count";
import { EmptyStep as EmptyStepPart, EmptySteps } from "../empty";
import { EntryStatus } from "../entry-status";
import { FormField, FormFieldError, FormFieldLabel as FormFieldLabelPart } from "../field";
import { FilterButton } from "../filter-button";
import { IconButton } from "../icon-button";
import { type IconName, iconsByName } from "../icons";
import { Image as ImagePart } from "../image";
import { Input as InputPart } from "../input";
import { ListHead } from "../list-head";
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
import { SearchToggle as SearchTogglePart } from "../search-box";
import { Section } from "../section";
import { Select, SelectTrigger, SelectValue } from "../select";
import { Separator } from "../separator";
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
import { ListScroll, RowActions, RowCheck, RowLink, RowTitle, Table, TableBody, TableCell, TableRow } from "../table";
import { TabLink, TabLinks } from "../tabs";
import { Heading, Text } from "../text";
import { TextButton } from "../text-button";
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
}: {
	label?: string;
	current?: boolean;
	count?: string;
	countTone?: "default" | "warning";
}) {
	return (
		<TabLink current={current} count={count} countTone={countTone}>
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
function SelectBox({ value, size, width }: { value?: string; size?: "sm" | "default"; width?: "fit" | "full" }) {
	return (
		<Select items={[{ value: "shown", label: value ?? "" }]} value="shown">
			<SelectTrigger size={size} width={width}>
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
function AffixField({ prefix, suffix, placeholder }: { prefix?: string; suffix?: string; placeholder?: string }) {
	return <Affix prefix={prefix} suffix={suffix} placeholder={placeholder} />;
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
export const SCREEN = { spacing: [2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48], group: "Stack" };

/**
 * The parts a screen spec can name, by the name it uses. `pnpm gen:screen-catalog` reads their prop types into `catalog.generated.json`, which
 * `checkSpec` checks a spec against; add a part here and run it.
 */
export const parts = {
	Box,
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
			minHeight: "layout",
			width: "layout-number",
			maxWidth: "layout-number",
			minWidth: "layout-number",
		},
	},
	Box: { kind: "part", props: { border: "variant" } },
	TwoLineCell: { kind: "part", props: { title: "text", sub: "text", proposal: "flag" } },
	SelectBox: { kind: "part", props: { value: "text", size: "variant", width: "variant" } },
	Filter: { kind: "part", props: { label: "text", filled: "flag" } },
	Banner: { kind: "part", props: { title: "text", meta: "text", tone: "variant" } },
	AffixField: { kind: "part", props: { prefix: "text", suffix: "text", placeholder: "text" } },
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
	Tab: { kind: "part", props: { label: "text", current: "flag", count: "text", countTone: "variant" } },
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
