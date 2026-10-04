"use client";

import { addedMarkName } from "@monti-cms/admin/editor";
import {
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
	IconButton,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@monti-cms/admin/kit";
import { createTranslator, getPluginOptions } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { Baseline, Check } from "lucide-react";
import {
	type ColorPair,
	cleanTextColor,
	DEFAULT_TEXT_PALETTE,
	hasTextColor,
	type PaletteColor,
	type TextColorAttrs,
	textColorProps,
} from "./colors";
import { colorBlock } from "./definition";
import { colorMessages } from "./messages";

const t = createTranslator(colorMessages);

/** 편집기 마크 이름(`cmsColor`). */
export const COLOR_MARK_NAME = addedMarkName(colorBlock.name);

/** 고르기 목록. 확장 옵션 `color({ palette })`, 없으면 기본 8색이다. */
const PALETTE: readonly PaletteColor[] =
	getPluginOptions<{ palette?: readonly PaletteColor[] }>("color")?.palette ?? DEFAULT_TEXT_PALETTE;

type ColorKind = "fg" | "bg";

const currentColor = (editor: Editor): TextColorAttrs => cleanTextColor(editor.getAttributes(COLOR_MARK_NAME));

/** 선택한 글의 글자색이나 배경색 하나만 바꾼다. 둘 다 빠지면 표시를 없앤다. */
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

/** 글자 "가" 견본. 실제 본문과 같은 `.cms-color` 규칙이라 지금 테마의 색으로 보인다. */
function Swatch({ kind, color }: { kind: ColorKind; color: ColorPair | null }) {
	const props = color
		? textColorProps(kind === "fg" ? { fg: color.light, fgDark: color.dark } : { bg: color.light, bgDark: color.dark })
		: null;
	return (
		<span
			aria-hidden
			{...(props ?? {})}
			className={cn(
				"flex size-6 items-center justify-center rounded-md border font-medium text-xs",
				props?.className,
				// 배경 견본은 둥근 사각형을 꽉 채운다(본문 배경색의 여백·모서리 규칙을 덮는다).
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
	/** `menu`는 드롭다운 항목, `buttons`는 일반 버튼(서식 버블 안). */
	variant?: "menu" | "buttons";
	onPicked?: () => void;
}) {
	const current = currentColor(editor)[kind] ?? null;
	const options: { name: string; color: ColorPair | null }[] = [
		{ name: t("default"), color: null },
		...PALETTE.map((color) => ({ name: color.name, color: color[kind] })),
	];
	return (
		<div className="grid grid-cols-9 gap-1 px-1 pb-1">
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
										className="relative justify-center p-0.5"
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
										className="relative flex justify-center rounded-sm p-0.5 outline-none hover:bg-cms-accent focus-visible:ring-2 focus-visible:ring-cms-ring"
									/>
								)
							}
						>
							<Swatch kind={kind} color={color} />
							{selected && (
								<Check
									aria-hidden
									className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-cms-primary p-px text-cms-primary-foreground"
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

/** 글자색·배경색 고르기 목록. 툴바 메뉴와 "더보기" 메뉴가 함께 쓴다. */
export function TextColorMenuItems({ editor }: { editor: Editor }) {
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

/** 서식 버블 안에서 펼치는 글자색·배경색 고르기. 고르면 `onPicked`를 부른다. */
export function TextColorPanel({ editor, onPicked }: { editor: Editor; onPicked?: () => void }) {
	return (
		<div className="flex flex-col gap-1">
			<p className="px-1 text-cms-muted-foreground">{t("fg.label")}</p>
			<SwatchRow editor={editor} kind="fg" variant="buttons" onPicked={onPicked} />
			<p className="px-1 text-cms-muted-foreground">{t("bg.label")}</p>
			<SwatchRow editor={editor} kind="bg" variant="buttons" onPicked={onPicked} />
		</div>
	);
}

/** 글자색 버튼 아이콘. 지금 고른 글의 글자색·배경색으로 칠해 보인다(툴바와 서식 버블이 같이 쓴다). */
export function TextColorIcon({ editor }: { editor: Editor }) {
	const current = currentColor(editor);
	const underline = textColorProps({ fg: current.fg, fgDark: current.fgDark, bg: current.bg, bgDark: current.bgDark });
	return (
		<span {...underline} className={cn(underline.className, "rounded-sm p-0.5")}>
			<Baseline aria-hidden className="size-4" />
		</span>
	);
}

/** 툴바의 글자색 버튼. 아이콘이 지금 글자색을 보여 준다. */
export function TextColorMenu({ editor }: { editor: Editor }) {
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
			<DropdownMenuContent align="start" className="w-auto">
				<TextColorMenuItems editor={editor} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
