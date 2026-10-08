"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn, Field, FieldLabel, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@monti-cms/admin/kit";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { useId } from "react";
import { customBlocksOf, customEngines, customResults } from "../custom.js";
import { customMessages } from "./custom-editor.messages.js";
import { useLabels } from "./labels.messages.js";
/** Select field of the AI screen. The closed field shows the name, not the value. */
export function OptionSelect({ id, value, options, onChange, disabled, className, "aria-label": ariaLabel, }) {
    return (_jsxs(Select, { value: value, items: options, disabled: disabled, onValueChange: (next) => typeof next === "string" && onChange(next), children: [_jsx(SelectTrigger, { id: id, size: "sm", "aria-label": ariaLabel, className: cn("w-full min-w-0 text-xs", className), children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: options.map((option) => (_jsx(SelectItem, { value: option.value, className: "text-xs", children: option.label }, option.value))) })] }));
}
/** Fields that can have a button next to them (text, URL, relation, select fields). Also picks the option values of conditional fields. The value is `collection:field`. */
const fieldOptionsOf = (site) => site.COLLECTIONS.flatMap((collection) => Object.entries(site.schemaOf(collection).fields).flatMap(([name, field]) => {
    const target = field.kind === "conditional" ? field.discriminant : field;
    return target.kind === "text" || target.kind === "slug" || target.kind === "relation" || target.kind === "select"
        ? [
            {
                value: `${collection}:${name}`,
                label: `${site.COLLECTION_DEFINITIONS[collection]?.label} · ${target.label}`,
            },
        ]
        : [];
}));
/** Attach target picker. Names are built in the language at render time. */
const placeOptionsOf = (site, t, { slotLabel, slotTargetLabel }) => [
    { value: "field", label: t("place.field"), surface: null },
    { value: "selection", label: slotLabel("selection"), surface: { slot: "selection" } },
    { value: "insert", label: slotLabel("insert"), surface: { slot: "insert" } },
    ...customBlocksOf(site).map((block) => ({
        value: `block:${block.name}`,
        label: `${slotLabel("block")} · ${block.label}`,
        surface: { slot: "block", block: block.name },
    })),
    {
        value: "image:alt",
        label: `${slotLabel("image")} · ${slotTargetLabel("image", "alt")}`,
        surface: { slot: "image", target: "alt" },
    },
    {
        value: "image:caption",
        label: `${slotLabel("image")} · ${slotTargetLabel("image", "caption")}`,
        surface: { slot: "image", target: "caption" },
    },
    {
        value: "media:filename",
        label: `${t("place.media")} · ${slotTargetLabel("media", "filename")}`,
        surface: { slot: "media", target: "filename" },
    },
    {
        value: "media:defaultAlt",
        label: `${t("place.media")} · ${slotTargetLabel("media", "defaultAlt")}`,
        surface: { slot: "media", target: "defaultAlt" },
    },
    {
        value: "media:defaultCaption",
        label: `${t("place.media")} · ${slotTargetLabel("media", "defaultCaption")}`,
        surface: { slot: "media", target: "defaultCaption" },
    },
];
const placeValue = (surface) => surface.slot === "field"
    ? "field"
    : surface.slot === "block"
        ? `block:${surface.block}`
        : "target" in surface
            ? `${surface.slot}:${surface.target}`
            : surface.slot;
/** First field slot. If there is no text or URL field, it is the selection menu. */
const firstField = (site) => {
    const [collection, field] = (fieldOptionsOf(site)[0]?.value ?? "").split(":");
    return collection && field ? { slot: "field", field, collections: [collection] } : { slot: "selection" };
};
/** Result shape and mode matched to the slot. Values that cannot be used become the first value (for relation and select fields, the judge mode comes first). */
const fitted = (site, base, surface) => {
    const results = customResults(site, surface);
    const engines = customEngines(site, surface);
    const engine = base.engine && engines.includes(base.engine) ? base.engine : engines[0];
    return {
        ...base,
        surface,
        result: results.includes(base.result) ? base.result : (results[0] ?? "text"),
        ...(engine === "decide" ? { engine } : { engine: undefined }),
    };
};
export const NEW_CUSTOM_BASE = (site) => fitted(site, { label: "", surface: firstField(site), result: "text" }, firstField(site));
/** Basic info inputs. Changing the attach target turns result shapes and modes that cannot be used there into the first value. */
export function CustomBaseFields({ base, onChange }) {
    const site = useSite();
    const t = useTranslator(customMessages);
    const labels = useLabels();
    const { resultLabel, engineLabel } = labels;
    const ids = { label: useId(), place: useId(), field: useId(), result: useId(), engine: useId() };
    const setSurface = (surface) => onChange(fitted(site, base, surface));
    const placeOptions = placeOptionsOf(site, t, labels);
    const fieldOptions = fieldOptionsOf(site);
    const engines = customEngines(site, base.surface);
    const fieldValue = base.surface.slot === "field" ? `${base.surface.collections?.[0] ?? ""}:${base.surface.field}` : "";
    return (_jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [_jsxs(Field, { className: "sm:col-span-2", children: [_jsx(FieldLabel, { htmlFor: ids.label, children: t("field.name") }), _jsx(Input, { id: ids.label, value: base.label, maxLength: 40, onChange: (event) => onChange({ ...base, label: event.target.value }), className: "h-8 text-xs md:text-xs" })] }), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.place, children: t("field.place") }), _jsx(OptionSelect, { id: ids.place, value: placeValue(base.surface), options: placeOptions, onChange: (value) => {
                            const option = placeOptions.find((item) => item.value === value);
                            if (option)
                                setSurface(option.surface ?? firstField(site));
                        } })] }), base.surface.slot === "field" ? (_jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.field, children: t("field.field") }), _jsx(OptionSelect, { id: ids.field, value: fieldValue, options: fieldOptions, onChange: (value) => {
                            const [collection, field] = value.split(":");
                            if (collection && field)
                                setSurface({ slot: "field", field, collections: [collection] });
                        } })] })) : (_jsx("div", {})), _jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.result, children: t("field.result") }), _jsx(OptionSelect, { id: ids.result, value: base.result, options: customResults(site, base.surface).map((result) => ({ value: result, label: resultLabel(result) })), onChange: (result) => onChange({ ...base, result: result }) })] }), engines.length > 1 && (_jsxs(Field, { children: [_jsx(FieldLabel, { htmlFor: ids.engine, children: t("field.engine") }), _jsx(OptionSelect, { id: ids.engine, value: base.engine ?? "generate", options: engines.map((engine) => ({ value: engine, label: engineLabel(engine) })), onChange: (value) => {
                            const engine = value;
                            onChange({ ...base, engine: engine === "decide" ? engine : undefined });
                        } })] }))] }));
}
