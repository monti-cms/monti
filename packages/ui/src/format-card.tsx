"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Link2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Spark } from "./ai-action";
import { cn } from "./cn";
import { useUiLabels } from "./labels";
import { MENU_CARD, MENU_ITEM, MENU_SEPARATOR, MenuShortcut } from "./menu-parts";

/** How each inline format looks on its button: the letter itself, in the style it gives. */
const FORMAT_GLYPHS = {
	bold: { glyph: "B", className: "font-bold" },
	italic: { glyph: "I", className: "italic" },
	underline: { glyph: "U", className: "underline" },
	strike: { glyph: "S", className: "line-through" },
	code: { glyph: "</>", className: "font-mono text-monti-meta" },
	superscript: { glyph: "x²", className: "text-monti-label" },
	subscript: { glyph: "x₂", className: "text-monti-label" },
	link: { glyph: <Link2 aria-hidden className="size-4" />, className: "" },
	// The glyph is a word of the app's language (`footnoteMark` in the ui labels), so it is read from them in `FormatButton`.
	footnote: { glyph: null, className: "text-monti-label" },
	more: { glyph: "⋯", className: "" },
} satisfies Record<string, { glyph: ReactNode; className: string }>;

type FormatMark = keyof typeof FORMAT_GLYPHS;

/**
 * One inline format of the format card, drawn as the letter it gives (B, I, U …). `pressed` marks one the selected text already has. `more` is the ⋯
 * that opens the formats a site added: wrap it with `render` to make it the trigger of a menu.
 */
function FormatButton({
	mark,
	label,
	pressed,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "aria-pressed" | "children"> & {
	mark: FormatMark;
	/** The format's name for screen readers. */
	label: string;
	pressed?: boolean;
}) {
	const labels = useUiLabels();
	const { glyph, className: glyphClassName } = FORMAT_GLYPHS[mark];
	return (
		<ButtonPrimitive
			data-slot="format-button"
			type="button"
			aria-label={label}
			aria-pressed={mark === "more" ? undefined : pressed}
			// Do not take the selection or the focus from the text on press.
			onMouseDown={(event) => event.preventDefault()}
			className={cn(
				"flex h-8 cursor-pointer items-center justify-center rounded-[7px] border-0 bg-transparent p-0 text-monti-body text-monti-muted outline-none transition-colors hover:bg-monti-selected hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20 aria-expanded:bg-monti-selected aria-pressed:bg-monti-selected aria-pressed:text-monti-default",
				glyphClassName,
				className,
			)}
			{...props}
		>
			{mark === "footnote" ? labels.footnoteMark : glyph}
		</ButtonPrimitive>
	);
}

/**
 * The card that appears over selected text: the inline formats in rows of five (`FormatButton`), and under a rule one row that asks the
 * assistant ("✦ Request ⌘J"). There is no toolbar that stays on screen; this card, the block handle and the / menu hold every tool.
 */
function FormatCard({
	requestLabel,
	requestShortcut,
	onRequest,
	className,
	children,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	/** The formats. */
	children: ReactNode;
	/** The words of the row that asks the assistant. */
	requestLabel: string;
	/** Its key combination. */
	requestShortcut?: string;
	onRequest: () => void;
}) {
	return (
		<div data-slot="format-card" className={cn(MENU_CARD, "w-[214px] p-monti-6", className)} {...props}>
			<div className="grid grid-cols-5 gap-monti-2 p-monti-2">{children}</div>
			<span className={MENU_SEPARATOR} />
			<button
				type="button"
				className={cn(MENU_ITEM, "w-full cursor-pointer border-0 bg-transparent text-left text-monti-default")}
				onMouseDown={(event) => event.preventDefault()}
				onClick={onRequest}
			>
				<span className="flex shrink-0 text-monti-proposal">
					<Spark className="size-4" />
				</span>
				{requestLabel}
				{requestShortcut && <MenuShortcut>{requestShortcut}</MenuShortcut>}
			</button>
		</div>
	);
}

export { FormatButton, FormatCard, type FormatMark };
