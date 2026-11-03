import type * as React from "react";
import { Box as BoxPart } from "../box";
import { Button } from "../button";
import { Count } from "../count";
import { EntryStatus } from "../entry-status";
import { FormField, FormFieldError, FormFieldLabel } from "../field";
import { IconButton } from "../icon-button";
import { ICONS, type IconName } from "../icons";
import { Image } from "../image";
import { Input } from "../input";
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
import { SearchToggle } from "../search-box";
import { Separator } from "../separator";
import { Stack as StackPart } from "../stack";
import { ListScroll, RowActions, RowCheck, RowLink, RowTitle, Table, TableBody, TableCell, TableRow } from "../table";
import { Heading, Text } from "../text";
import { TextButton } from "../text-button";

/** An icon by its name in the design system's icon table, in a part that takes its icon as children (a button, an icon button). */
function Icon({ name }: { name: IconName }) {
	const Glyph = ICONS[name];
	return <Glyph aria-hidden />;
}

/** A form that posts to an address: its `action` is the name of a thing the screen does. */
function Form({
	className,
	...props
}: {
	action?: string;
	method?: "get" | "post";
	className?: string;
	children?: React.ReactNode;
}) {
	return <form className={className} {...props} />;
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

/** The design system's line: `bottom-contrast` is the ink rule under a title. Only the line; a box's other options are not a screen spec's. */
function Box({ border, className }: { border: "top" | "bottom" | "bottom-contrast"; className?: string }) {
	return <BoxPart border={border} className={className} />;
}

/**
 * The parts a screen spec can name, by the name it uses. `pnpm gen:screen-catalog` reads their prop types into `screen-catalog.generated.json`, which
 * `checkSpec` checks a spec against; add a part here and run it.
 */
export const parts = {
	Box,
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
 * - `text`: words the screen shows (a label, a placeholder), from the dictionary or the data.
 * - `attribute`: what names or wires an element (its id, its input type, the field a label is for, an address).
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
	Form: { kind: "part", props: { action: "attribute", method: "attribute" } },
	Heading: { kind: "part", props: { as: "attribute", variant: "variant", tone: "variant", truncate: "flag" } },
	Text: {
		kind: "part",
		props: {
			as: "attribute",
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
	FormFieldLabel: { kind: "part", props: { htmlFor: "attribute" } },
	Input: {
		kind: "part",
		props: {
			id: "attribute",
			name: "attribute",
			type: "attribute",
			autoComplete: "attribute",
			required: "attribute",
			minLength: "attribute",
			placeholder: "text",
			size: "variant",
			width: "variant",
			mono: "flag",
		},
	},
	FormFieldError: { kind: "part", props: { id: "attribute" } },
	Button: {
		kind: "part",
		props: {
			type: "attribute",
			variant: "variant",
			size: "variant",
			width: "variant",
			disabled: "flag",
			loading: "flag",
		},
	},
	Separator: { kind: "part", props: { label: "text", length: "variant" } },
	Image: { kind: "part", props: { src: "attribute", alt: "text", size: "variant", radius: "variant", fit: "variant" } },
	Icon: { kind: "part", props: { name: "variant" } },
	PageColumn: { kind: "part", props: { width: "variant" } },
	PageHeader: { kind: "part", props: {} },
	TextButton: { kind: "part", props: { type: "attribute", variant: "variant", size: "variant", tone: "variant" } },
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
	TableCell: {
		kind: "part",
		props: { align: "variant", tone: "variant", width: "variant", truncate: "flag", colSpan: "attribute" },
	},
	RowCheck: { kind: "part", props: { checked: "flag", proposal: "flag", label: "text", onCheckedChange: "event" } },
	RowLink: { kind: "part", props: { href: "attribute" } },
	RowTitle: { kind: "part", props: { folder: "flag" } },
	RowActions: { kind: "part", props: {} },
	EntryStatus: { kind: "part", props: { status: "variant", quiet: "flag" } },
	Count: { kind: "part", props: { tone: "variant" } },
	IconButton: { kind: "part", props: { type: "attribute", tone: "variant", label: "text" } },
	SearchToggle: {
		kind: "part",
		props: {
			label: "text",
			"aria-label": "text",
			placeholder: "text",
			value: "attribute",
			targets: "data:value,label",
			onValueChange: "event",
			onTargetChange: "event",
		},
	},
	ListFooter: { kind: "part", props: {} },
	PageSizeMenu: {
		kind: "part",
		props: { label: "text", value: "attribute", options: "data:value,label", onValueChange: "event" },
	},
	Pagination: { kind: "part", props: {} },
	PaginationContent: { kind: "part", props: {} },
	PaginationItem: { kind: "part", props: {} },
	PaginationLink: { kind: "part", props: { href: "attribute", isActive: "flag", disabled: "flag" } },
	PaginationPrevious: { kind: "part", props: { href: "attribute", disabled: "flag" } },
	PaginationNext: { kind: "part", props: { href: "attribute", disabled: "flag" } },
};
