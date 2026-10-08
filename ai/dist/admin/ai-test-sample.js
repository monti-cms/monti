"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { cn, Input, Textarea } from "@monti-cms/admin/kit";
import { isUuid, useSite, useTranslator } from "@monti-cms/core/client";
import { aiCommonMessages } from "./ai-common.messages.js";
import { OptionSelect } from "./custom-editor.js";
/** Fields shown in the test: inputs to send (including required ones) and language inputs (which go into the instructions). The judge mode does not read images. */
export function sampleFields(feature, send) {
    return Object.entries(feature.input).flatMap(([name, input]) => {
        if (feature.engine === "decide" && input.kind === "image")
            return [];
        if (input.kind !== "locale" && !input.required && !send.includes(name))
            return [];
        return [{ name, kind: input.kind, label: input.label, required: input.required }];
    });
}
/** Initial value of a field. The first language input is the default language; the next language input is the first non-default language (source -> target). */
export function sampleDefaults(site, feature) {
    const defaults = {};
    let locales = 0;
    for (const [name, input] of Object.entries(feature.input)) {
        if (input.kind !== "locale")
            continue;
        defaults[name] = locales++ === 0 ? site.DEFAULT_LOCALE : (site.PREFIXED_LOCALES[0] ?? site.DEFAULT_LOCALE);
    }
    return defaults;
}
/** Current value of a field. If never edited, it is the initial value. */
export const sampleValue = (values, defaults, name) => values[name] ?? defaults[name] ?? "";
/** Whether any required field is empty (if so, it does not run). */
export const missingRequired = (fields, values, defaults) => fields.some((field) => field.required && !sampleValue(values, defaults, field.name).trim());
/**
 * Builds the run input and common information from the test values. Empty fields are not sent. A field-slot action runs with the first collection, and a translation-slot action with
 * the target language (`to`, an input the translation slot provides).
 */
export function sampleRun(feature, fields, values, defaults = {}) {
    const input = {};
    for (const field of fields) {
        const value = sampleValue(values, defaults, field.name);
        if (!value.trim())
            continue;
        if (field.kind === "image") {
            const location = value.trim();
            input[field.name] = isUuid(location) ? { mediaId: location } : { src: location };
        }
        else
            input[field.name] = value;
    }
    const env = {};
    const field = feature.attach.find((attach) => attach.slot === "field");
    const collection = field?.slot === "field" ? field.collections?.[0] : undefined;
    if (collection)
        env.collection = collection;
    const target = input.to;
    if (feature.attach.some((attach) => attach.slot === "translation") && typeof target === "string") {
        env.locale = target;
    }
    return { input, env };
}
/** Test fields. A field's name (aria-label, placeholder) is the input's label. */
export function SampleInputs({ fields, values, defaults, onChange, }) {
    const site = useSite();
    const t = useTranslator(aiCommonMessages);
    const localeOptions = site.LOCALES.map((locale) => ({ value: locale, label: site.localeLabel(locale) }));
    return fields.map((field) => {
        const value = sampleValue(values, defaults, field.name);
        const common = {
            "aria-label": field.label,
            placeholder: field.kind === "image" ? t("sampleMediaId", { label: field.label }) : field.label,
            value,
        };
        switch (field.kind) {
            case "locale":
                return (_jsx(OptionSelect, { "aria-label": field.label, value: value, options: localeOptions, onChange: (next) => onChange(field.name, next), className: "w-auto self-start bg-cms-background" }, field.name));
            case "image":
            case "value":
                return (_jsx(Input, { ...common, onChange: (event) => onChange(field.name, event.target.value), className: cn("h-8 bg-cms-background text-xs md:text-xs", field.kind === "image" && "font-mono") }, field.name));
            default:
                return (_jsx(Textarea, { ...common, rows: field.kind === "text" ? 2 : 4, onChange: (event) => onChange(field.name, event.target.value), className: cn("bg-cms-background text-xs md:text-xs", field.kind !== "text" && "font-mono") }, field.name));
        }
    });
}
