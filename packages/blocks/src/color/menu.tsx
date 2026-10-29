"use client";

import { Checkmark } from "@carbon/icons-react";
import { useSite, useTranslator } from "@monti-cms/admin";
import { addedMarkName } from "@monti-cms/admin/editor";
import { Box, cn, Stack, Text, Tooltip, TooltipContent, TooltipTrigger } from "@monti-cms/admin/kit";
import type { Editor } from "@tiptap/core";
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
		<span
			aria-hidden
			{...(props ?? {})}
			className={cn(
				"flex size-6 items-center justify-center rounded-monti-md border font-medium text-monti-caption",
				props?.className,
				// The background sample fills the rectangle completely (overriding the body background color's padding and corner rules).
				kind === "bg" && "![padding:0] !rounded-monti-md",
			)}
		>
			{t("sample")}
		</span>
	);
}

function SwatchRow({ editor, kind, onPicked }: { editor: Editor; kind: ColorKind; onPicked?: () => void }) {
	const t = useTranslator(colorMessages);
	const palette = usePalette();
	const current = currentColor(editor)[kind] ?? null;
	const options: { name: string; color: ColorPair | null }[] = [
		{ name: t("default"), color: null },
		...palette.map((color) => ({ name: color.name, color: color[kind] })),
	];
	return (
		<div className="grid grid-cols-9 gap-monti-4 px-monti-4 pb-monti-4">
			{options.map(({ name, color }) => {
				const selected = (color?.light.toLowerCase() ?? null) === current;
				return (
					<Tooltip key={name}>
						<TooltipTrigger
							render={
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
									className="relative flex justify-center rounded-monti-sm p-monti-2 outline-none hover:bg-monti-selected focus-visible:ring-2 focus-visible:ring-monti-contrast"
								/>
							}
						>
							<Swatch kind={kind} color={color} />
							{selected && (
								<Checkmark
									aria-hidden
									className="absolute -top-0.5 -right-0.5 size-3 rounded-monti-full bg-monti-emphasis p-px text-monti-on-emphasis"
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

/** Text/background color picker that expands inside the format bubble. Calls `onPicked` when a color is chosen. */
export function TextColorPanel({ editor, onPicked }: { editor: Editor; onPicked?: () => void }) {
	const t = useTranslator(colorMessages);
	return (
		<Stack gap={4}>
			<Box paddingX={4}>
				<Text as="p" tone="muted">
					{t("fg.label")}
				</Text>
			</Box>
			<SwatchRow editor={editor} kind="fg" onPicked={onPicked} />
			<Box paddingX={4}>
				<Text as="p" tone="muted">
					{t("bg.label")}
				</Text>
			</Box>
			<SwatchRow editor={editor} kind="bg" onPicked={onPicked} />
		</Stack>
	);
}
