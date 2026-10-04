"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { CODE_CHAR_EFFECTS, checkPattern, escapePattern, newEffectId, ruleMatches, } from "@monti-cms/core/code-block";
import { Plus, Regex, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils/cn.js";
import { useSlot } from "../../slots/slots.js";
import { Button } from "../../ui/button.js";
import { IconButton } from "../../ui/icon-button.js";
import { Input } from "../../ui/input.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { Switch } from "../../ui/switch.js";
import { Textarea } from "../../ui/textarea.js";
import { codeBlockMessages } from "./messages.js";
const t = createTranslator(codeBlockMessages);
const EFFECT_OPTIONS = CODE_CHAR_EFFECTS.map((effect) => ({ value: effect.name, label: effect.label }));
const SCOPE_OPTIONS = [
    { value: "document", label: t("rulesPanel.scopeDocument") },
    { value: "line", label: t("rulesPanel.scopeLine") },
];
function RuleRow({ rule, text, lineCount, onChange, onRemove, }) {
    const problem = checkPattern(rule.pattern, rule.flags);
    const count = problem ? 0 : ruleMatches(rule, text).length;
    return (_jsxs("li", { className: "flex flex-col gap-1.5 rounded-md border p-2", "aria-label": t("rulesPanel.rule", { pattern: rule.pattern }), children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsxs(Select, { value: rule.name, items: EFFECT_OPTIONS, onValueChange: (value) => value && onChange({ ...rule, name: value, attrs: {} }), children: [_jsx(SelectTrigger, { size: "sm", className: "h-7 text-xs", "aria-label": t("rulesPanel.effect"), children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: EFFECT_OPTIONS.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }), _jsxs(Select, { value: rule.scope === "document" ? "document" : "line", items: SCOPE_OPTIONS, onValueChange: (value) => value &&
                            onChange(value === "document"
                                ? { ...rule, scope: "document", line: undefined }
                                : { ...rule, scope: "char", line: rule.line ?? 0 }), children: [_jsx(SelectTrigger, { size: "sm", className: "h-7 text-xs", "aria-label": t("rulesPanel.scope"), children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: SCOPE_OPTIONS.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }), rule.scope === "char" && (_jsx(Input, { "aria-label": t("rulesPanel.lineNumber"), type: "number", min: 1, max: lineCount, value: (rule.line ?? 0) + 1, onChange: (event) => {
                            const line = Math.min(lineCount, Math.max(1, Number(event.target.value) || 1)) - 1;
                            onChange({ ...rule, line });
                        }, className: "h-7 w-14 px-1.5 text-xs" })), _jsx(IconButton, { label: t("rulesPanel.remove"), size: "icon-xs", destructive: true, onClick: onRemove, className: "ml-auto", children: _jsx(Trash2, { "aria-hidden": true }) })] }), _jsxs("div", { className: "flex items-center gap-1 font-mono text-xs", children: [_jsx("span", { className: "text-cms-muted-foreground", children: "/" }), _jsx(Input, { "aria-label": t("rulesPanel.pattern"), value: rule.pattern, placeholder: t("rulesPanel.patternPlaceholder"), onChange: (event) => onChange({ ...rule, pattern: event.target.value }), className: "h-7 flex-1 px-1.5 font-mono text-xs", "aria-invalid": !!problem && rule.pattern.length > 0 }), _jsx("span", { className: "text-cms-muted-foreground", children: "/" }), _jsx(Input, { "aria-label": t("rulesPanel.flags"), value: rule.flags, onChange: (event) => onChange({ ...rule, flags: event.target.value.replace(/[^a-z]/gi, "") }), className: "h-7 w-10 px-1.5 font-mono text-xs" })] }), rule.name === "Tooltip" && (_jsx(Textarea, { "aria-label": t("rulesPanel.tooltipContent"), value: String(rule.attrs.content ?? ""), placeholder: t("rulesPanel.tooltipContent"), rows: 1, onChange: (event) => onChange({ ...rule, attrs: { ...rule.attrs, content: event.target.value } }), className: "min-h-7 px-1.5 py-1 text-xs md:text-xs" })), rule.name === "fold" && (_jsxs("label", { htmlFor: `${rule.id}-open`, className: "flex items-center gap-2 text-xs", children: [_jsx(Switch, { id: `${rule.id}-open`, size: "sm", checked: rule.attrs.open === true, onCheckedChange: (checked) => onChange({ ...rule, attrs: { ...rule.attrs, open: checked || undefined } }) }), t("rulesPanel.openFromStart")] })), _jsx("p", { className: cn("text-[11px]", problem && rule.pattern ? "text-cms-destructive" : "text-cms-muted-foreground"), children: problem ? (rule.pattern ? problem : t("rulesPanel.enterPattern")) : t("rulesPanel.matches", { count }) })] }));
}
/**
 * List of regex rules (`// @document fold {re:/.../}`, etc.). Even if the code is edited, rules find and apply the effect again.
 * If text is picked, "Add rule" starts as a rule that finds that text.
 */
export function RulesPanel({ rules, text, lineCount, selection, language, slotScope, onChange }) {
    // Code block rules spot. Clicking a candidate regex adds it as a char collapse rule.
    const foldSlot = useSlot({
        slot: "codeRules",
        target: "fold",
        scope: slotScope,
        getContext: () => ({ code: text, language: language ?? undefined }),
        apply: (pattern) => onChange([...rules, { id: newEffectId(), scope: "document", name: "fold", pattern, flags: "g", attrs: {} }]),
    });
    const addRule = () => onChange([
        ...rules,
        {
            id: newEffectId(),
            scope: "document",
            name: "fold",
            pattern: selection?.text ? escapePattern(selection.text) : "",
            flags: "g",
            attrs: {},
        },
    ]);
    return (_jsxs(Popover, { children: [_jsxs(IconButton, { label: t("rulesPanel.title"), size: "sm", className: cn("h-7 min-w-7 gap-1 px-1.5 text-xs", rules.length > 0 && "text-cms-foreground"), trigger: (button) => _jsx(PopoverTrigger, { render: button }), children: [_jsx(Regex, { "aria-hidden": true, className: "size-3.5" }), rules.length > 0 && _jsx("span", { className: "tabular-nums", children: rules.length })] }), _jsxs(PopoverContent, { align: "end", className: "w-96 gap-2 p-3 text-xs", "data-code-ui": "", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("p", { className: "font-semibold", children: t("rulesPanel.title") }), foldSlot.trigger] }), foldSlot.panel, rules.length > 0 && (_jsx("ul", { className: "flex max-h-80 flex-col gap-2 overflow-y-auto", children: rules.map((rule) => (_jsx(RuleRow, { rule: rule, text: text, lineCount: lineCount, onChange: (next) => onChange(rules.map((item) => (item.id === rule.id ? next : item))), onRemove: () => onChange(rules.filter((item) => item.id !== rule.id)) }, rule.id))) })), _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: addRule, className: "self-start", children: [_jsx(Plus, { "aria-hidden": true }), selection?.text ? t("rulesPanel.addFromSelection") : t("rulesPanel.add")] })] })] }));
}
