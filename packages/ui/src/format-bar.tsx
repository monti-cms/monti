"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Link } from "@carbon/icons-react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "./cn";
import { BAR_BUTTON, FloatingBarButton } from "./floating-bar";
import { useUiLabels } from "./labels";
import type { ShortcutKeys } from "./shortcut";
import { Spark } from "./spark";

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
	shortcut?: ShortcutKeys;
	pressed?: boolean;
	trigger?: (button: ReactElement) => ReactElement;
}) {
	const labels = useUiLabels();
	const { glyph, className: glyphClassName } = FORMAT_GLYPHS[mark];
	return (
		<FloatingBarButton
			label={label}
			shortcut={shortcut}
			pressed={mark === "more" ? undefined : pressed}
			trigger={trigger}
			className={cn(glyphClassName, className)}
			{...props}
		>
			{mark === "footnote" ? labels.footnoteMark : glyph}
		</FloatingBarButton>
	);
}

/** The last button of the bar: a blue ✦ and the word that asks the assistant about the selected text. A button shows no shortcut. */
function FormatBarRequest({
	label,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "children"> & {
	/** The word on the button ("Request"). */
	label: string;
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
		</ButtonPrimitive>
	);
}

export { FormatBarRequest, FormatButton, type FormatMark };
