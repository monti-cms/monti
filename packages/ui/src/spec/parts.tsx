import type * as React from "react";
import { AuthPage } from "../auth-page";
import { Button } from "../button";
import { FormField, FormFieldError, FormFieldLabel } from "../field";
import { Image } from "../image";
import { Input } from "../input";
import { Separator } from "../separator";
import { Stack as StackPart } from "../stack";
import { Heading, Text } from "../text";

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
	className,
	children,
}: {
	direction?: "column" | "row";
	className?: string;
	children?: React.ReactNode;
}) {
	return (
		<StackPart direction={direction} gap={0} className={className}>
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
] as const;
