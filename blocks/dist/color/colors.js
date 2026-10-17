import { IssueList, pathOf } from "@monti-cms/core";
/** Default picker list, with the color names in the language `t` picks. Change it with the extension option `color({ palette })`. */
export const defaultTextPalette = (t) => [
    {
        id: "gray",
        name: t("palette.gray"),
        fg: { light: "#6b7280", dark: "#9ca3af" },
        bg: { light: "#f1f2f4", dark: "#2f3237" },
    },
    {
        id: "red",
        name: t("palette.red"),
        fg: { light: "#dc2626", dark: "#f87171" },
        bg: { light: "#fee2e2", dark: "#4a1f1f" },
    },
    {
        id: "orange",
        name: t("palette.orange"),
        fg: { light: "#ea580c", dark: "#fb923c" },
        bg: { light: "#ffedd5", dark: "#4a2a14" },
    },
    {
        id: "yellow",
        name: t("palette.yellow"),
        fg: { light: "#b45309", dark: "#facc15" },
        bg: { light: "#fef3c7", dark: "#453a12" },
    },
    {
        id: "green",
        name: t("palette.green"),
        fg: { light: "#16a34a", dark: "#4ade80" },
        bg: { light: "#dcfce7", dark: "#173d2a" },
    },
    {
        id: "blue",
        name: t("palette.blue"),
        fg: { light: "#2563eb", dark: "#60a5fa" },
        bg: { light: "#dbeafe", dark: "#172f4d" },
    },
    {
        id: "purple",
        name: t("palette.purple"),
        fg: { light: "#9333ea", dark: "#c084fc" },
        bg: { light: "#f3e8ff", dark: "#33224d" },
    },
    {
        id: "pink",
        name: t("palette.pink"),
        fg: { light: "#db2777", dark: "#f472b6" },
        bg: { light: "#fce7f3", dark: "#4a1d38" },
    },
];
export const TEXT_COLOR_ATTRS = ["fg", "fgDark", "bg", "bgDark"];
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** Accepts only `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`. Other values are dropped because they go straight into styles. */
export const isHexColor = (value) => typeof value === "string" && HEX.test(value);
/** Keeps only the usable values from the attributes (lowercase). Returns an empty object if nothing remains. */
export function cleanTextColor(attrs) {
    const out = {};
    for (const name of TEXT_COLOR_ATTRS) {
        const value = attrs?.[name];
        if (isHexColor(value))
            out[name] = value.toLowerCase();
    }
    return out;
}
export const hasTextColor = (attrs) => Boolean(attrs.fg || attrs.bg);
/**
 * Display attributes shared by the public page and the editor. CSS (`.monti-color`, this package's `render.css` for the public page and `styles.css` for the editor) picks the variable for the theme.
 * Color is applied only when `data-fg` or `data-bg` is present.
 */
export function textColorProps(attrs) {
    const style = {};
    if (attrs.fg)
        style["--monti-fg"] = attrs.fg;
    if (attrs.fgDark)
        style["--monti-fg-dark"] = attrs.fgDark;
    if (attrs.bg)
        style["--monti-bg"] = attrs.bg;
    if (attrs.bgDark)
        style["--monti-bg-dark"] = attrs.bgDark;
    return {
        className: "monti-color",
        ...(attrs.fg ? { "data-fg": "" } : {}),
        ...(attrs.bg ? { "data-bg": "" } : {}),
        style,
    };
}
/** The problems of the picker list (`color({ palette })`): hex values and unique `id`s. */
export function checkTextPalette(palette) {
    const list = new IssueList();
    const ids = new Set();
    for (const [index, color] of (palette ?? []).entries()) {
        const at = pathOf("plugins", "color", "palette", index);
        if (!color.id || ids.has(color.id))
            list.add(pathOf(at, "id"), "id", "must be set and unique");
        ids.add(color.id);
        for (const [part, value] of [
            ["fg.light", color.fg.light],
            ["fg.dark", color.fg.dark],
            ["bg.light", color.bg.light],
            ["bg.dark", color.bg.dark],
        ]) {
            if (!isHexColor(value))
                list.add(`${at}.${part}`, "hex-color", `"${value}" is not a hex color`);
        }
    }
    return list.issues;
}
