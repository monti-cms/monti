"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Link } from "@carbon/icons-react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { BAR, BAR_BUTTON, BAR_SEPARATOR } from "./block-bar";
import { cn } from "./cn";
import { useUiLabels } from "./labels";
import { Spark } from "./spark";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** How each inline format looks on its button: the letter itself, in the style it gives. */
const FORMAT_GLYPHS = {
	bold: { glyph: "B", className: "font-bold" },
	italic: { glyph: "I", className: "italic" },
	underline: { glyph: "U", className: "underline" },
	strike: { glyph: "S", className: "line-through" },
	code: { glyph: "</>", className: "font-mono text-monti-meta" },
	superscript: { glyph: "x²", className: "text-monti-label" },
	subscript: { glyph: "x₂", className: "text-monti-label" },
	link: { glyph: <Link aria-hidden className="size-4" />, className: "" },
	// The glyph is a word of the app's language (`footnoteMark` in the ui labels), so it is read from them in `FormatButton`.
	footnote: { glyph: null, className: "text-monti-label" },
	more: { glyph: "⋯", className: "" },
} satisfies Record<string, { glyph: ReactNode; className: string }>;

type FormatMark = keyof typeof FORMAT_GLYPHS;

/**
 * A button of the format bar: 28px high and at least as wide, its name in a tooltip (with its key combination when it has one). `pressed` keeps the
 * background while the format is on. It does not take the selection or the focus from the text on press. To make it the trigger of a menu or card, wrap it
 * with `trigger`: `trigger={(button) => <PopoverTrigger render={button} />}`.
 */
function FormatBarButton({
	label,
	shortcut,
	pressed,
	tone,
	trigger,
	className,
	children,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "aria-pressed" | "children"> & {
	/** The name of the button: its screen reader name and its tooltip. */
	label: string;
	/** The key combination that does the same ("⌘B"), shown in the tooltip. */
	shortcut?: string;
	pressed?: boolean;
	/** `danger` for a button that removes something. */
	tone?: "danger";
	trigger?: (button: ReactElement) => ReactElement;
	children: ReactNode;
}) {
	const button = (
		<ButtonPrimitive
			data-slot="format-bar-button"
			type="button"
			aria-label={label}
			aria-pressed={pressed}
			data-tone={tone}
			// Do not take the selection or the focus from the text on press.
			onMouseDown={(event) => event.preventDefault()}
			className={cn(BAR_BUTTON, "min-w-7 px-monti-4 text-monti-body", className)}
			{...props}
		/>
	);
	return (
		<Tooltip>
			<TooltipTrigger render={trigger ? trigger(button) : button}>{children}</TooltipTrigger>
			<TooltipContent side="top" shortcut={shortcut}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * One inline format of the format bar, drawn as the letter it gives (B, I, U …). `pressed` marks one the selected text already has. `more` is the ⋯
 * that opens the formats a site added: give it a `trigger` to make it the trigger of a menu.
 */
function FormatButton({
	mark,
	label,
	shortcut,
	pressed,
	trigger,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "aria-pressed" | "children"> & {
	mark: FormatMark;
	/** The format's name for screen readers and the tooltip. */
	label: string;
	shortcut?: string;
	pressed?: boolean;
	trigger?: (button: ReactElement) => ReactElement;
}) {
	const labels = useUiLabels();
	const { glyph, className: glyphClassName } = FORMAT_GLYPHS[mark];
	return (
		<FormatBarButton
			label={label}
			shortcut={shortcut}
			pressed={mark === "more" ? undefined : pressed}
			trigger={trigger}
			className={cn(glyphClassName, className)}
			{...props}
		>
			{mark === "footnote" ? labels.footnoteMark : glyph}
		</FormatBarButton>
	);
}

/**
 * The bar that floats above selected text: the inline formats as letters (`FormatButton`), a `FormatBarSeparator` between groups, and at the end the
 * button that asks the assistant (`FormatBarRequest`, "✦ Request ⌘J"). It is one row that does not change; there is no toolbar that stays on screen, this
 * bar, the block handle and the / menu hold every tool.
 */
function FormatBar({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="format-bar" role="toolbar" className={cn(BAR, "whitespace-nowrap", className)} {...props} />;
}

/** The line between two groups of formats. */
function FormatBarSeparator() {
	return <span data-slot="format-bar-separator" aria-hidden className={BAR_SEPARATOR} />;
}

/** The last button of the bar: a blue ✦, the word that asks the assistant about the selected text, and its key combination. */
function FormatBarRequest({
	label,
	shortcut,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "children"> & {
	/** The word on the button ("Request"). */
	label: string;
	/** Its key combination, in mono after the word. */
	shortcut?: string;
}) {
	return (
		<ButtonPrimitive
			data-slot="format-bar-request"
			type="button"
			// Do not take the selection or the focus from the text on press.
			onMouseDown={(event) => event.preventDefault()}
			className={cn(BAR_BUTTON, "gap-monti-4 px-monti-8 text-monti-body text-monti-default", className)}
			{...props}
		>
			<Spark className="size-4 text-monti-proposal" />
			{label}
			{shortcut && <span className="ml-monti-4 font-mono text-monti-micro text-monti-subtle">{shortcut}</span>}
		</ButtonPrimitive>
	);
}

export { FormatBar, FormatBarButton, FormatBarRequest, FormatBarSeparator, FormatButton, type FormatMark };
