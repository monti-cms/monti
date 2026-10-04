/**
 * 글자색·글자 배경색(`:color[글]{fg="#…" fgDark="#…" bg="#…" bgDark="#…"}`).
 * 본문에는 색을 이름이 아니라 헥스 값으로 저장한다. 밝은·어두운 테마 값을 짝으로 두고, 어두운 값이 없으면
 * 밝은 값을 그대로 쓴다. 편집기의 고르기 목록은 확장 옵션 `color({ palette })`이고, 없으면 아래 기본 프리셋이다.
 * 직접 고른 색도 같은 모양으로 저장한다.
 */

import { createActiveTranslator } from "@monti-cms/core";
import { colorMessages } from "./messages";

// 기본 색 이름은 글자를 읽는 때에 화면 언어로 고른다(설정 파일이 이 모듈을 불러오는 때에는 언어를 아직 모른다).
const t = createActiveTranslator(colorMessages);

export interface ColorPair {
	readonly light: string;
	readonly dark: string;
}

export interface PaletteColor {
	readonly id: string;
	readonly name: string;
	/** 글자색. */
	readonly fg: ColorPair;
	/** 글자 배경색. */
	readonly bg: ColorPair;
}

/** 기본 고르기 목록. 확장 옵션 `color({ palette })`로 바꾼다. */
export const DEFAULT_TEXT_PALETTE: readonly PaletteColor[] = [
	{
		id: "gray",
		get name() {
			return t("palette.gray");
		},
		fg: { light: "#6b7280", dark: "#9ca3af" },
		bg: { light: "#f1f2f4", dark: "#2f3237" },
	},
	{
		id: "red",
		get name() {
			return t("palette.red");
		},
		fg: { light: "#dc2626", dark: "#f87171" },
		bg: { light: "#fee2e2", dark: "#4a1f1f" },
	},
	{
		id: "orange",
		get name() {
			return t("palette.orange");
		},
		fg: { light: "#ea580c", dark: "#fb923c" },
		bg: { light: "#ffedd5", dark: "#4a2a14" },
	},
	{
		id: "yellow",
		get name() {
			return t("palette.yellow");
		},
		fg: { light: "#b45309", dark: "#facc15" },
		bg: { light: "#fef3c7", dark: "#453a12" },
	},
	{
		id: "green",
		get name() {
			return t("palette.green");
		},
		fg: { light: "#16a34a", dark: "#4ade80" },
		bg: { light: "#dcfce7", dark: "#173d2a" },
	},
	{
		id: "blue",
		get name() {
			return t("palette.blue");
		},
		fg: { light: "#2563eb", dark: "#60a5fa" },
		bg: { light: "#dbeafe", dark: "#172f4d" },
	},
	{
		id: "purple",
		get name() {
			return t("palette.purple");
		},
		fg: { light: "#9333ea", dark: "#c084fc" },
		bg: { light: "#f3e8ff", dark: "#33224d" },
	},
	{
		id: "pink",
		get name() {
			return t("palette.pink");
		},
		fg: { light: "#db2777", dark: "#f472b6" },
		bg: { light: "#fce7f3", dark: "#4a1d38" },
	},
];

/** 본문 `:color`의 속성. 빈 값은 그 색을 쓰지 않는다는 뜻이다. */
export interface TextColorAttrs {
	fg?: string | null;
	fgDark?: string | null;
	bg?: string | null;
	bgDark?: string | null;
}

export const TEXT_COLOR_ATTRS = ["fg", "fgDark", "bg", "bgDark"] as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** `#rgb`·`#rgba`·`#rrggbb`·`#rrggbbaa`만 받는다. 스타일에 그대로 넣으므로 다른 값은 버린다. */
export const isHexColor = (value: unknown): value is string => typeof value === "string" && HEX.test(value);

/** 속성에서 쓸 수 있는 값만 남긴다(소문자). 남은 것이 없으면 빈 객체다. */
export function cleanTextColor(attrs: Readonly<Record<string, unknown>> | null | undefined): TextColorAttrs {
	const out: TextColorAttrs = {};
	for (const name of TEXT_COLOR_ATTRS) {
		const value = attrs?.[name];
		if (isHexColor(value)) out[name] = value.toLowerCase();
	}
	return out;
}

export const hasTextColor = (attrs: TextColorAttrs): boolean => Boolean(attrs.fg || attrs.bg);

/**
 * 공개 화면·에디터가 함께 쓰는 표시 속성. CSS(`.cms-color`, 이 패키지의 `styles.css`)가 테마에 맞춰 변수를 고른다.
 * `data-fg`·`data-bg`가 있을 때만 색을 입힌다.
 */
export function textColorProps(attrs: TextColorAttrs): {
	className: string;
	"data-fg"?: "";
	"data-bg"?: "";
	style: Record<string, string>;
} {
	const style: Record<string, string> = {};
	if (attrs.fg) style["--cms-fg"] = attrs.fg;
	if (attrs.fgDark) style["--cms-fg-dark"] = attrs.fgDark;
	if (attrs.bg) style["--cms-bg"] = attrs.bg;
	if (attrs.bgDark) style["--cms-bg-dark"] = attrs.bgDark;
	return {
		className: "cms-color",
		...(attrs.fg ? { "data-fg": "" as const } : {}),
		...(attrs.bg ? { "data-bg": "" as const } : {}),
		style,
	};
}

/** 프리셋과 같은 색이면 그 프리셋. 고르기 목록에서 지금 색을 표시할 때 쓴다. */
export function paletteOf(
	kind: "fg" | "bg",
	attrs: TextColorAttrs,
	palette: readonly PaletteColor[] = DEFAULT_TEXT_PALETTE,
): PaletteColor | undefined {
	const light = attrs[kind];
	if (!light) return undefined;
	return palette.find((color) => color[kind].light.toLowerCase() === light.toLowerCase());
}

/** 고르기 목록(`color({ palette })`)이 맞는지 확인한다(헥스 값, 겹치지 않는 `id`). */
export function validateTextPalette(palette: readonly PaletteColor[] | undefined): void {
	const ids = new Set<string>();
	for (const color of palette ?? []) {
		const at = `cms.config: plugins.color.palette.${color.id}`;
		if (!color.id || ids.has(color.id)) throw new Error(`${at}: id is empty or duplicated`);
		ids.add(color.id);
		for (const value of [color.fg.light, color.fg.dark, color.bg.light, color.bg.dark]) {
			if (!isHexColor(value)) throw new Error(`${at}: "${value}" is not a hex color`);
		}
	}
}
