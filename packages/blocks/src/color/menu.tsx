"use client";

import { useSite, useTranslator } from "@monti-cms/admin";
import { addedMarkName } from "@monti-cms/admin/editor";
import {
	Box,
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
	IconButton,
	Stack,
	Text,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@monti-cms/admin/kit";
import type { Editor } from "@tiptap/core";
import { Baseline, Check } from "lucide-react";
import {
	type ColorPair,
	cleanTextColor,
	defaultTextPalette,
	hasTextColor,
	type PaletteColor,
	type TextColorAttrs,
	textColorProps,
} from "./colors";
import { colorBlock } from "./definition";
import { colorMessages } from "./messages";
import { COLOR_PLUGIN } from "./options";

/** Editor mark name (`cmsColor`). */
export const COLOR_MARK_NAME = addedMarkName(colorBlock.name);

/** Picker list. The extension option `color({ palette })`, or the default 8 colors if absent. */
function usePalette(): readonly PaletteColor[] {
	const site = useSite();
	const t = useTranslator(colorMessages);
	return site.pluginOptions(COLOR_PLUGIN)?.palette ?? defaultTextPalette(t);
}

type ColorKind = "fg" | "bg";

const currentColor = (editor: Editor): TextColorAttrs => cleanTextColor(editor.getAttributes(COLOR_MARK_NAME));

/** Changes only the text color or only the background color of the selected text. If both end up removed, the mark is removed. */
export function applyTextColor(editor: Editor, kind: ColorKind, color: ColorPair | null) {
	const current = currentColor(editor);
	const next: TextColorAttrs =
		kind === "fg"
			? { ...current, fg: color?.light ?? null, fgDark: color?.dark ?? null }
			: { ...current, bg: color?.light ?? null, bgDark: color?.dark ?? null };
	const chain = editor.chain().focus();
	if (hasTextColor(next)) {
		chain
			.setMark(COLOR_MARK_NAME, {
				fg: next.fg ?? null,
				fgDark: next.fgDark ?? null,
				bg: next.bg ?? null,
				bgDark: next.bgDark ?? null,
			})
			.run();
	} else {
		chain.unsetMark(COLOR_MARK_NAME).run();
	}
}

/** Sample letter (a Hangul syllable). It uses the same `.monti-color` rule as the real body, so it shows in the current theme's color. */
function Swatch({ kind, color }: { kind: ColorKind; color: ColorPair | null }) {
	const t = useTranslator(colorMessages);
	const props = color
		? textColorProps(kind === "fg" ? { fg: color.light, fgDark: color.dark } : { bg: color.light, bgDark: color.dark })
		: null;
	return (
		// design-system: drawing — a color sample painted by the mark's own classes and variables (the real body color rule)
		<span
			aria-hidden
			{...(props ?? {})}
			className={cn(
				"flex size-6 items-center justify-center rounded-md border font-medium text-monti-caption",
				props?.className,
				// The background sample fills the rectangle completely (overriding the body background color's padding and corner rules).
				kind === "bg" && "![padding:0] !rounded-md",
			)}
		>
			{t("sample")}
		</span>
	);
}

function SwatchRow({
	editor,
	kind,
	variant = "menu",
	onPicked,
}: {
	editor: Editor;
	kind: ColorKind;
	/** `menu` is a dropdown item, `buttons` is a regular button (inside the format bubble). */
	variant?: "menu" | "buttons";
	onPicked?: () => void;
}) {
	const t = useTranslator(colorMessages);
	const palette = usePalette();
	const current = currentColor(editor)[kind] ?? null;
	const options: { name: string; color: ColorPair | null }[] = [
		{ name: t("default"), color: null },
		...palette.map((color) => ({ name: color.name, color: color[kind] })),
	];
	return (
		// design-system: drawing — the swatch grid (9 columns of color samples); the picker items and the check badge below keep their raw classes with it
		<div className="grid grid-cols-9 gap-tight px-tight pb-tight">
			{options.map(({ name, color }) => {
				const selected = (color?.light.toLowerCase() ?? null) === current;
				return (
					<Tooltip key={name}>
						<TooltipTrigger
							render={
								variant === "menu" ? (
									<DropdownMenuItem
										aria-label={t("pick", { kind: t(kind === "fg" ? "fg.label" : "bg.label"), name })}
										aria-checked={selected}
										disabled={!editor.isEditable}
										onClick={() => applyTextColor(editor, kind, color)}
										className="relative justify-center p-hair"
									/>
								) : (
									<button
										type="button"
										aria-label={t("pick", { kind: t(kind === "fg" ? "fg.label" : "bg.label"), name })}
										aria-pressed={selected}
										disabled={!editor.isEditable}
										onMouseDown={(event) => event.preventDefault()}
										onClick={() => {
											applyTextColor(editor, kind, color);
											onPicked?.();
										}}
										className="relative flex justify-center rounded-sm p-hair outline-none hover:bg-monti-hover focus-visible:ring-2 focus-visible:ring-monti-focus"
									/>
								)
							}
						>
							<Swatch kind={kind} color={color} />
							{selected && (
								<Check
									aria-hidden
									className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-monti-emphasis p-px text-monti-on-emphasis"
								/>
							)}
						</TooltipTrigger>
						<TooltipContent side="bottom">{name}</TooltipContent>
					</Tooltip>
				);
			})}
		</div>
	);
}

/** Text/background color picker list. Shared by the toolbar menu and the "More" menu. */
export function TextColorMenuItems({ editor }: { editor: Editor }) {
	const t = useTranslator(colorMessages);
	return (
		<>
			<DropdownMenuGroup>
				<DropdownMenuLabel>{t("fg.label")}</DropdownMenuLabel>
				<SwatchRow editor={editor} kind="fg" />
			</DropdownMenuGroup>
			<DropdownMenuGroup>
				<DropdownMenuLabel>{t("bg.label")}</DropdownMenuLabel>
				<SwatchRow editor={editor} kind="bg" />
			</DropdownMenuGroup>
		</>
	);
}

/** Text/background color picker that expands inside the format bubble. Calls `onPicked` when a color is chosen. */
export function TextColorPanel({ editor, onPicked }: { editor: Editor; onPicked?: () => void }) {
	const t = useTranslator(colorMessages);
	return (
		<Stack gap="tight">
			<Box paddingX="tight">
				<Text as="p" tone="muted">
					{t("fg.label")}
				</Text>
			</Box>
			<SwatchRow editor={editor} kind="fg" variant="buttons" onPicked={onPicked} />
			<Box paddingX="tight">
				<Text as="p" tone="muted">
					{t("bg.label")}
				</Text>
			</Box>
			<SwatchRow editor={editor} kind="bg" variant="buttons" onPicked={onPicked} />
		</Stack>
	);
}

/** Text color button icon. Painted with the text and background colors of the current selection (shared by the toolbar and the format bubble). */
export function TextColorIcon({ editor }: { editor: Editor }) {
	const current = currentColor(editor);
	const underline = textColorProps({ fg: current.fg, fgDark: current.fgDark, bg: current.bg, bgDark: current.bgDark });
	return (
		// design-system: drawing — the icon painted with the selection's text and background colors
		<span {...underline} className={cn(underline.className, "rounded-sm p-hair")}>
			<Baseline aria-hidden className="size-4" />
		</span>
	);
}

/** Text color button in the toolbar. The icon shows the current text color. */
export function TextColorMenu({ editor }: { editor: Editor }) {
	const t = useTranslator(colorMessages);
	return (
		<DropdownMenu>
			<IconButton
				label={t("label")}
				side="bottom"
				disabled={!editor.isEditable}
				onMouseDown={(event) => event.preventDefault()}
				trigger={(button) => <DropdownMenuTrigger render={button} />}
			>
				<TextColorIcon editor={editor} />
			</IconButton>
			{/* design-system: needs DropdownMenuContent width="auto" (a menu as wide as its swatch grid) */}
			<DropdownMenuContent align="start" className="w-auto">
				<TextColorMenuItems editor={editor} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
