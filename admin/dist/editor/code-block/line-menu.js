"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { COLLAPSE, canAddCollapse, hasLineEffect, newEffectId, setLineEffect, } from "@monti-cms/core/code-block";
import { Check, ChevronsDownUp, ChevronsUpDown, Code2, Eye, Highlighter } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils/cn.js";
import { useIconByName } from "../../screens/shared/collection-icon.js";
import { codeBlockMessages } from "./messages.js";
const ITEM_CLASS = "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-cms-accent disabled:pointer-events-none disabled:opacity-50";
function MenuItem({ disabled, title, onSelect, children }) {
    return (_jsx("button", { type: "button", role: "menuitem", disabled: disabled, title: title, onMouseDown: (event) => event.preventDefault(), onClick: onSelect, className: ITEM_CLASS, children: children }));
}
function CheckItem({ checked, onSelect, children }) {
    return (_jsxs("button", { type: "button", role: "menuitemcheckbox", "aria-checked": checked, onMouseDown: (event) => event.preventDefault(), onClick: onSelect, className: ITEM_CLASS, children: [children, _jsx(Check, { "aria-hidden": true, className: cn("ml-auto size-3.5", !checked && "invisible") })] }));
}
/**
 * Line effects the menu lists for the picked lines [start, end): the offered ones (`site.OFFERED_LINE_EFFECTS`) plus any omitted one
 * that is already on those lines, so it stays visible and can be turned off. Definition order.
 */
export function lineEffectsToList(site, lineEffects, start, end) {
    return site.CODE_LINE_EFFECTS.filter((effect) => site.OFFERED_LINE_EFFECTS.some((offered) => offered.name === effect.name) ||
        lineEffects.some((item) => item.name === effect.name && item.start < end && item.end > start));
}
/** Whether the line menu has anything to show for the picked lines (an offered effect, folding, linking to body text, or an existing effect to turn off). */
export function lineMenuAvailable(site, lineEffects, start, end, canLink) {
    return (canLink ||
        site.CODE_BLOCK_FEATURES.fold ||
        lineEffectsToList(site, lineEffects, start, end).length > 0 ||
        lineEffects.some((effect) => effect.name === COLLAPSE && effect.start < end && effect.end > start));
}
/** Menu that turns line effects (the effects and folds from the definition list) on and off for the lines picked in the line number gutter. Names and icons come from the effect definitions. */
export function LineMenu({ start, end, lineEffects, onChange, onClose, onLinkText, style }) {
    const site = useSite();
    const t = useTranslator(codeBlockMessages);
    const ref = useRef(null);
    const iconByName = useIconByName();
    // A fold equal to the picked range, or, when only one line is picked, a fold starting at that line (the first line with the › marker) (outermost first).
    const startingHere = lineEffects
        .filter((effect) => effect.name === COLLAPSE && effect.start === start)
        .sort((a, b) => b.end - a.end);
    const collapse = startingHere.find((effect) => effect.end === end) ?? (end - start === 1 ? startingHere[0] : undefined);
    const collapseProblem = collapse ? null : canAddCollapse(lineEffects, start, end);
    const listed = lineEffectsToList(site, lineEffects, start, end);
    const showFold = !!collapse || site.CODE_BLOCK_FEATURES.fold;
    useEffect(() => {
        const onDown = (event) => {
            if (event.target instanceof Node && !ref.current?.contains(event.target))
                onClose();
        };
        const onKey = (event) => {
            if (event.key === "Escape")
                onClose();
        };
        document.addEventListener("mousedown", onDown, true);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("mousedown", onDown, true);
            document.removeEventListener("keydown", onKey, true);
        };
    }, [onClose]);
    const setCollapseOpen = (open) => onChange(lineEffects.map((effect) => effect === collapse ? { ...effect, attrs: { ...effect.attrs, open: open || undefined } } : effect));
    return (_jsxs("div", { ref: ref, role: "menu", "aria-label": start + 1 === end
            ? t("lineMenu.lineEffects", { line: start + 1 })
            : t("lineMenu.rangeEffects", { start: start + 1, end }), "data-code-ui": "", contentEditable: false, style: style, className: "absolute z-20 flex w-44 flex-col gap-0.5 rounded-md border bg-cms-popover p-1 font-sans text-cms-popover-foreground shadow-md", children: [listed.map((effect) => {
                const active = hasLineEffect(lineEffects, effect.name, start, end);
                const Icon = iconByName(effect.icon) ?? Highlighter;
                return (_jsxs(CheckItem, { checked: active, onSelect: () => onChange(setLineEffect(lineEffects, effect.name, start, end, !active)), children: [_jsx(Icon, { "aria-hidden": true, className: "size-3.5" }), effect.label] }, effect.name));
            }), listed.length > 0 && showFold && _jsx("div", { "aria-hidden": true, className: "my-0.5 h-px bg-cms-border" }), collapse ? (_jsxs(_Fragment, { children: [_jsxs(MenuItem, { onSelect: () => onChange(lineEffects.filter((effect) => effect !== collapse)), children: [_jsx(ChevronsUpDown, { "aria-hidden": true, className: "size-3.5" }), t("lineMenu.uncollapse"), _jsx("span", { className: "ml-auto text-cms-muted-foreground", children: t("lineMenu.collapsedRange", { start: collapse.start + 1, end: collapse.end }) })] }), _jsxs(CheckItem, { checked: collapse.attrs.open === true, onSelect: () => setCollapseOpen(collapse.attrs.open !== true), children: [_jsx(Eye, { "aria-hidden": true, className: "size-3.5" }), t("lineMenu.openFromStart")] })] })) : site.CODE_BLOCK_FEATURES.fold ? (_jsxs(MenuItem, { disabled: !!collapseProblem, title: collapseProblem ?? undefined, onSelect: () => onChange([...lineEffects, { id: newEffectId(), name: COLLAPSE, start, end, attrs: {} }].sort((a, b) => a.start - b.start || b.end - a.end)), children: [_jsx(ChevronsDownUp, { "aria-hidden": true, className: "size-3.5" }), t("lineMenu.collapse")] })) : null, onLinkText && (_jsxs(_Fragment, { children: [(listed.length > 0 || showFold) && _jsx("div", { "aria-hidden": true, className: "my-0.5 h-px bg-cms-border" }), _jsxs(MenuItem, { onSelect: onLinkText, children: [_jsx(Code2, { "aria-hidden": true, className: "size-3.5" }), t("lineMenu.linkText")] })] }))] }));
}
