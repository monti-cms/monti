import { Add, Folder, OverflowMenuHorizontal, Search } from "@carbon/icons-react";
import type * as React from "react";
import { AuthPage } from "../auth-page";
import { Button } from "../button";
import { Count } from "../count";
import { EntryStatus } from "../entry-status";
import { FormField, FormFieldError, FormFieldLabel } from "../field";
import { IconButton } from "../icon-button";
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
import { Separator } from "../separator";
import { Stack as StackPart } from "../stack";
import { ListScroll, RowActions, RowCheck, RowLink, RowTitle, Table, TableBody, TableCell, TableRow } from "../table";
import { Heading, Text } from "../text";
import { TextButton } from "../text-button";

/** The icons a spec can name. A glyph is a component, so a spec names it and this table gives it. */
const ICONS = { add: Add, folder: Folder, more: OverflowMenuHorizontal, search: Search } as const;

/** An icon by name, in a part that takes its icon as children (a button, an icon button). */
function Icon({ name }: { name: keyof typeof ICONS }) {
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
	ListFooter,
	PageSizeMenu,
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationPrevious,
	PaginationNext,
};

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
