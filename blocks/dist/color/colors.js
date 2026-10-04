/**
 * Text color and text background color (`:color[text]{fg="#…" fgDark="#…" bg="#…" bgDark="#…"}`).
 * The body stores colors as hex values, not names. Light and dark theme values are paired, and when there is no dark value
 * the light value is used as is. The editor's picker list is the extension option `color({ palette })`, falling back to the default presets below.
 * Custom-picked colors are stored in the same shape.
 */
import { createActiveTranslator } from "@monti-cms/core";
import { colorMessages } from "./messages.js";
// Default color names are resolved in the UI language when the text is read (the language is not yet known when the config file imports this module).
const t = createActiveTranslator(colorMessages);
/** Default picker list. Change it with the extension option `color({ palette })`. */
export const DEFAULT_TEXT_PALETTE = [
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
 * Display attributes shared by the public page and the editor. CSS (`.cms-color`, this package's `styles.css`) picks the variable for the theme.
 * Color is applied only when `data-fg` or `data-bg` is present.
 */
export function textColorProps(attrs) {
    const style = {};
    if (attrs.fg)
        style["--cms-fg"] = attrs.fg;
    if (attrs.fgDark)
        style["--cms-fg-dark"] = attrs.fgDark;
    if (attrs.bg)
        style["--cms-bg"] = attrs.bg;
    if (attrs.bgDark)
        style["--cms-bg-dark"] = attrs.bgDark;
    return {
        className: "cms-color",
        ...(attrs.fg ? { "data-fg": "" } : {}),
        ...(attrs.bg ? { "data-bg": "" } : {}),
        style,
    };
}
/** The preset if the color matches one. Used to mark the current color in the picker list. */
export function paletteOf(kind, attrs, palette = DEFAULT_TEXT_PALETTE) {
    const light = attrs[kind];
    if (!light)
        return undefined;
    return palette.find((color) => color[kind].light.toLowerCase() === light.toLowerCase());
}
/** Checks that the picker list (`color({ palette })`) is valid (hex values, unique `id`s). */
export function validateTextPalette(palette) {
    const ids = new Set();
    for (const color of palette ?? []) {
        const at = `cms.config: plugins.color.palette.${color.id}`;
        if (!color.id || ids.has(color.id))
            throw new Error(`${at}: id is empty or duplicated`);
        ids.add(color.id);
        for (const value of [color.fg.light, color.fg.dark, color.bg.light, color.bg.dark]) {
            if (!isHexColor(value))
                throw new Error(`${at}: "${value}" is not a hex color`);
        }
    }
}
