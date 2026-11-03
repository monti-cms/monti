import * as React from "react";
import { Box as BoxPart } from "../box";
import { Button } from "../button";
import { ChangeDot } from "../change-dot";
import { Count } from "../count";
import { EmptyStep as EmptyStepPart, EmptySteps } from "../empty";
import { EntryStatus } from "../entry-status";
import { FormField, FormFieldError, FormFieldLabel as FormFieldLabelPart } from "../field";
import { IconButton } from "../icon-button";
import { type IconName, iconsByName } from "../icons";
import { Image as ImagePart } from "../image";
import { Input as InputPart } from "../input";
import { ListHead } from "../list-head";
import { PageColumn, PageHeader } from "../page-header";
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
import { Stack as StackPart } from "../stack";
import { ListScroll, RowActions, RowCheck, RowLink, RowTitle, Table, TableBody, TableCell, TableRow } from "../table";
import { Heading, Text } from "../text";
import { TextButton } from "../text-button";

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
