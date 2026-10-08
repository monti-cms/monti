"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { addedMarkName } from "@monti-cms/admin/editor";
import { cn, DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, IconButton, Tooltip, TooltipContent, TooltipTrigger, } from "@monti-cms/admin/kit";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { Baseline, Check } from "lucide-react";
import { cleanTextColor, defaultTextPalette, hasTextColor, textColorProps, } from "./colors.js";
import { colorBlock } from "./definition.js";
import { colorMessages } from "./messages.js";
/** Editor mark name (`cmsColor`). */
export const COLOR_MARK_NAME = addedMarkName(colorBlock.name);
/** Picker list. The extension option `color({ palette })`, or the default 8 colors if absent. */
function usePalette() {
    const site = useSite();
    const t = useTranslator(colorMessages);
    return site.getPluginOptions("color")?.palette ?? defaultTextPalette(t);
}
const currentColor = (editor) => cleanTextColor(editor.getAttributes(COLOR_MARK_NAME));
/** Changes only the text color or only the background color of the selected text. If both end up removed, the mark is removed. */
export function applyTextColor(editor, kind, color) {
    const current = currentColor(editor);
    const next = kind === "fg"
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
    }
    else {
        chain.unsetMark(COLOR_MARK_NAME).run();
    }
}
/** Sample of the letter "가". It uses the same `.cms-color` rule as the real body, so it shows in the current theme's color. */
function Swatch({ kind, color }) {
    const t = useTranslator(colorMessages);
    const props = color
        ? textColorProps(kind === "fg" ? { fg: color.light, fgDark: color.dark } : { bg: color.light, bgDark: color.dark })
        : null;
    return (_jsx("span", { "aria-hidden": true, ...(props ?? {}), className: cn("flex size-6 items-center justify-center rounded-md border font-medium text-xs", props?.className, 
        // The background sample fills the rounded rectangle completely (overriding the body background color's padding and corner rules).
        kind === "bg" && "![padding:0] !rounded-md"), children: t("sample") }));
}
function SwatchRow({ editor, kind, variant = "menu", onPicked, }) {
    const t = useTranslator(colorMessages);
    const palette = usePalette();
    const current = currentColor(editor)[kind] ?? null;
    const options = [
        { name: t("default"), color: null },
        ...palette.map((color) => ({ name: color.name, color: color[kind] })),
    ];
    return (_jsx("div", { className: "grid grid-cols-9 gap-1 px-1 pb-1", children: options.map(({ name, color }) => {
            const selected = (color?.light.toLowerCase() ?? null) === current;
            return (_jsxs(Tooltip, { children: [_jsxs(TooltipTrigger, { render: variant === "menu" ? (_jsx(DropdownMenuItem, { "aria-label": t("pick", { kind: t(kind === "fg" ? "fg.label" : "bg.label"), name }), "aria-checked": selected, disabled: !editor.isEditable, onClick: () => applyTextColor(editor, kind, color), className: "relative justify-center p-0.5" })) : (_jsx("button", { type: "button", "aria-label": t("pick", { kind: t(kind === "fg" ? "fg.label" : "bg.label"), name }), "aria-pressed": selected, disabled: !editor.isEditable, onMouseDown: (event) => event.preventDefault(), onClick: () => {
                                applyTextColor(editor, kind, color);
                                onPicked?.();
                            }, className: "relative flex justify-center rounded-sm p-0.5 outline-none hover:bg-cms-accent focus-visible:ring-2 focus-visible:ring-cms-ring" })), children: [_jsx(Swatch, { kind: kind, color: color }), selected && (_jsx(Check, { "aria-hidden": true, className: "absolute -top-0.5 -right-0.5 size-3 rounded-full bg-cms-primary p-px text-cms-primary-foreground" }))] }), _jsx(TooltipContent, { side: "bottom", children: name })] }, name));
        }) }));
}
/** Text/background color picker list. Shared by the toolbar menu and the "More" menu. */
export function TextColorMenuItems({ editor }) {
    const t = useTranslator(colorMessages);
    return (_jsxs(_Fragment, { children: [_jsxs(DropdownMenuGroup, { children: [_jsx(DropdownMenuLabel, { children: t("fg.label") }), _jsx(SwatchRow, { editor: editor, kind: "fg" })] }), _jsxs(DropdownMenuGroup, { children: [_jsx(DropdownMenuLabel, { children: t("bg.label") }), _jsx(SwatchRow, { editor: editor, kind: "bg" })] })] }));
}
/** Text/background color picker that expands inside the format bubble. Calls `onPicked` when a color is chosen. */
export function TextColorPanel({ editor, onPicked }) {
    const t = useTranslator(colorMessages);
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("p", { className: "px-1 text-cms-muted-foreground", children: t("fg.label") }), _jsx(SwatchRow, { editor: editor, kind: "fg", variant: "buttons", onPicked: onPicked }), _jsx("p", { className: "px-1 text-cms-muted-foreground", children: t("bg.label") }), _jsx(SwatchRow, { editor: editor, kind: "bg", variant: "buttons", onPicked: onPicked })] }));
}
/** Text color button icon. Painted with the text and background colors of the current selection (shared by the toolbar and the format bubble). */
export function TextColorIcon({ editor }) {
    const current = currentColor(editor);
    const underline = textColorProps({ fg: current.fg, fgDark: current.fgDark, bg: current.bg, bgDark: current.bgDark });
    return (_jsx("span", { ...underline, className: cn(underline.className, "rounded-sm p-0.5"), children: _jsx(Baseline, { "aria-hidden": true, className: "size-4" }) }));
}
/** Text color button in the toolbar. The icon shows the current text color. */
export function TextColorMenu({ editor }) {
    const t = useTranslator(colorMessages);
    return (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: t("label"), side: "bottom", disabled: !editor.isEditable, onMouseDown: (event) => event.preventDefault(), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(TextColorIcon, { editor: editor }) }), _jsx(DropdownMenuContent, { align: "start", className: "w-auto", children: _jsx(TextColorMenuItems, { editor: editor }) })] }));
}
