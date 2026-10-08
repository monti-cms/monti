"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsFetch, errorText } from "@monti-cms/admin/api";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, cn, } from "@monti-cms/admin/kit";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { aiCommonMessages } from "./ai-common.messages.js";
/**
 * Model list of a generation connection. A list fetched once is not fetched again for 10 minutes, and is reused after saving or reopening.
 * If there is no `source`, it is not fetched.
 */
export function useModelList(source) {
    const site = useSite();
    const t = useTranslator(aiCommonMessages);
    const query = useQuery({
        queryKey: ["cms", "ai", "models", source],
        queryFn: async ({ signal }) => (await cmsFetch(site, cmsApiUrl("/v1/ai/models"), {
            method: "POST",
            json: source,
            signal,
            fallback: t("modelsFailed"),
        })).items,
        enabled: source !== null,
        staleTime: 10 * 60_000,
        retry: false,
    });
    return {
        models: query.data ?? null,
        loading: query.isFetching,
        error: query.error ? errorText(site, query.error, t("modelsFailed")) : null,
    };
}
/**
 * Model picker. Search the list and pick, or use a name that is not in the list exactly as typed.
 * Even without a list (judge model, or a URL that gives no list), you can type a name and pick it.
 */
export function ModelCombobox({ id, value, onChange, models, loading, error, placeholder, "aria-label": ariaLabel, }) {
    const t = useTranslator(aiCommonMessages);
    const [query, setQuery] = useState("");
    const options = useMemo(() => (models ?? []).map((model) => ({ value: model.id, label: model.id })), [models]);
    // Even if the chosen value is not in the list (a typed name), pass the same object for the same value so the typed text does not revert.
    const selected = useMemo(() => (value ? (options.find((option) => option.value === value) ?? { value, label: value }) : null), [value, options]);
    const typed = query.trim();
    const items = typed && typed !== value && !options.some((option) => option.value === typed)
        ? [...options, { value: typed, label: typed, custom: true }]
        : options;
    return (_jsxs(Combobox, { items: items, autoHighlight: true, value: selected, onValueChange: (next) => onChange(next?.value ?? ""), onInputValueChange: setQuery, itemToStringLabel: (item) => item.label, isItemEqualToValue: (a, b) => a.value === b.value, children: [_jsx(ComboboxInput, { id: id, "aria-label": ariaLabel, placeholder: loading ? t("modelsLoading") : placeholder, showClear: Boolean(value), className: "h-8 w-full min-w-0 [&_input]:font-mono [&_input]:text-xs" }), _jsxs(ComboboxContent, { children: [_jsx(ComboboxEmpty, { children: error ?? (loading ? t("modelsLoading") : t("modelsHint")) }), _jsx(ComboboxList, { children: (item) => (_jsx(ComboboxItem, { value: item, className: cn("font-mono text-xs", item.custom && "text-cms-primary"), children: _jsx("span", { className: "truncate", children: item.custom ? t("modelUse", { label: item.label }) : item.label }) }, item.value)) })] })] }));
}
