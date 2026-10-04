"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn, Switch } from "@monti-cms/admin/kit";
import { isCollection, roleValue, SUMMARY_ROLE } from "@monti-cms/core/client";
import { SEO_DEFAULT_LIMITS } from "../fields.js";
/** Recommended length: field `max` → `inputOptions.limit` → default. */
const limitOf = (field, fallback) => {
    if ("max" in field && typeof field.max === "number")
        return field.max;
    const limit = field.inputOptions?.limit;
    return typeof limit === "number" ? limit : fallback;
};
const current = (props) => (typeof props.value === "string" ? props.value : "");
/** Character count. Changes color when it exceeds the recommended length. When empty, it is the length of the fallback value. */
function Counter({ length, limit }) {
    return (_jsxs("span", { className: cn("text-[11px] text-cms-muted-foreground tabular-nums", length > limit && "cms-dark:text-amber-400 text-amber-600"), children: [length, "/", limit] }));
}
/** Input piece that shows a hint and character count using the value the public page falls back to when empty. */
const withFallback = (fallback, defaultLimit) => ({
    placeholder: (props) => fallback(props) || undefined,
    Aside: (props) => (_jsx(Counter, { length: (current(props) || fallback(props)).length, limit: limitOf(props.field, defaultLimit) })),
});
/** Search title: falls back to the title when empty. */
export const seoTitleInput = withFallback((props) => props.form.title, SEO_DEFAULT_LIMITS.title);
/** Search description: falls back to the summary role value when empty. */
export const seoDescriptionInput = withFallback((props) => (isCollection(props.collection) ? roleValue(props.collection, SUMMARY_ROLE, props.form) : ""), SEO_DEFAULT_LIMITS.description);
/** Hide from search engines: a switch in the label row. On is `noindex`, off is the default (or another option). */
function NoindexSwitch({ field, id, value, describedBy, context, onChange }) {
    if (field.kind !== "select")
        return null;
    const off = field.defaultValue !== "noindex"
        ? field.defaultValue
        : (Object.keys(field.options).find((option) => option !== "noindex") ?? field.defaultValue);
    const selected = typeof value === "string" ? value : field.defaultValue;
    return (_jsx(Switch, { id: id, size: "sm", checked: selected === "noindex", disabled: context.disabled, "aria-describedby": describedBy, onCheckedChange: (checked) => onChange(checked ? "noindex" : off) }));
}
export const seoNoindexInput = { Input: null, Aside: NoindexSwitch };
