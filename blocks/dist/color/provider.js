"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/admin";
import { allowsMark, BubbleButton, } from "@monti-cms/admin/editor";
import { DropdownMenuSeparator } from "@monti-cms/admin/kit";
import { cleanTextColor, textColorProps } from "./colors.js";
import { colorBlock } from "./definition.js";
import { COLOR_MARK_NAME, TextColorIcon, TextColorMenu, TextColorMenuItems, TextColorPanel } from "./menu.js";
import { colorMessages } from "./messages.js";
/** Text color display in the editor. The same `.monti-color` rule (`styles.css`, the same as `render.css` for the public page) picks the color for the theme. */
export function colorMarkAttributes(attrs) {
    const { className, style, ...data } = textColorProps(cleanTextColor(attrs));
    return {
        ...data,
        class: className,
        style: Object.entries(style)
            .map(([key, value]) => `${key}: ${value}`)
            .join("; "),
    };
}
function ColorBubbleButton({ editor, inCode, openPanel, closePanel }) {
    const t = useTranslator(colorMessages);
    if (inCode || !allowsMark(editor.state, COLOR_MARK_NAME))
        return null;
    return (_jsx(BubbleButton, { label: t("label"), onClick: () => openPanel({
            label: t("label"),
            size: "auto",
            content: _jsx(TextColorPanel, { editor: editor, onPicked: closePanel }),
        }), children: _jsx(TextColorIcon, { editor: editor }) }));
}
function ColorMenuItems({ editor }) {
    return (_jsxs(_Fragment, { children: [_jsx(DropdownMenuSeparator, { className: "first:hidden" }), _jsx(TextColorMenuItems, { editor: editor })] }));
}
/** Editor registration of the text color mark. Text typed right after a colored run does not inherit the color. */
export const colorMarkExtension = {
    render: colorMarkAttributes,
    toolbar: { group: "format", priority: 3, Button: TextColorMenu, MenuItems: ColorMenuItems },
    bubble: { group: "format", Button: ColorBubbleButton },
};
/** The text color mark's editor display, format tool, and bubble. */
export const colorComponents = { marks: { [colorBlock.name]: colorMarkExtension } };
