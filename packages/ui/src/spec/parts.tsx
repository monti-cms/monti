import type * as React from "react";
import { AuthPage } from "../auth-page";
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
	className,
	children,
}: {
	direction?: "column" | "row";
	align?: "start" | "center" | "end" | "baseline" | "stretch";
	justify?: "start" | "center" | "end" | "between";
	/** Takes the room its parent leaves on the parent's axis. */
	grow?: boolean;
	className?: string;
	children?: React.ReactNode;
}) {
	return (
		<StackPart direction={direction} align={align} justify={justify} grow={grow} gap={0} className={className}>
			{children}
		</StackPart>
	);
}

/**
 * The parts a screen spec can name, by the name it uses. `pnpm gen:screen-catalog` reads their prop types into `screen-catalog.generated.json`, which
 * `checkSpec` checks a spec against; add a part here and run it.
 */
export const parts = {
	AuthPage,
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
 * The props a spec fills from the data (a list, an object), with the fields each item may have. They carry what a screen shows, never how it looks: a
 * width, a color or a class is not a field here, so it cannot come in this way. A list or object prop missing from this table is not in the catalog.
 */
export const DATA_FIELDS = {
	"ListHead.columns": ["id", "label", "sort", "filtered"],
	"PageSizeMenu.options": ["value", "label"],
	"SearchToggle.targets": ["value", "label"],
};

/**
 * Props that take a number of pixels (a column's width, a table's total width). A spec never writes a size, so they are not in the catalog; a width a
 * screen needs is a design system choice (a token, a part's variant) first.
 */
export const PIXEL_PROPS = ["Table.width", "TableCell.size", "ListHead.end"];

/** The parts whose children a spec spaces with `Spacing` items. */
export const CONTAINERS: ReadonlySet<string> = new Set(["Stack"]);

/**
 * The props a part inherits from an HTML element that a spec may set. Every other inherited prop is left out of the catalog; the props a part declares
 * itself are all in, but `className`, `style` and handlers.
 */
export const HTML_PROPS = [
	"id",
	"name",
	"type",
	"htmlFor",
	"autoComplete",
	"placeholder",
	"required",
	"minLength",
	"disabled",
	"src",
	"alt",
	"as",
	"href",
	"colSpan",
] as const;
