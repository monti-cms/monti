"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { HOST_PATTERN, useTranslator } from "@monti-cms/core/site";
import { useState } from "react";
import { Button } from "../../ui/button.js";
import { Input } from "../../ui/input.js";
import { Labeled } from "../shared/labeled.js";
import { Section } from "../shared/section.js";
import { FlagSwitch, orUndefined, Pick, RowActions, TextInput, useSchemaEdit } from "./controls.js";
import { schemaMessages } from "./messages.js";
import { localesOf, moveItem, sectionOf, setSetting } from "./schema-model.js";
import { schemaSiteMessages } from "./site.messages.js";
const PREFIX_MODES = ["except-default", "always", "never"];
const URL_NOTE = {
    env: "site.url.env",
    schema: "site.url.schema",
    config: "site.url.config",
    none: "site.url.none",
};
/** The `site` settings of the file: name, home link, preview address, how the language shows in addresses, and other host names. The site URL is only shown. */
export function SiteEditor({ file, siteUrl, update, }) {
    const t = useTranslator(schemaSiteMessages);
    const ts = useTranslator(schemaMessages);
    const { disabled } = useSchemaEdit();
    const site = sectionOf(file, "site");
    const set = (key, value) => update((current) => setSetting(current, "site", key, value));
    const [host, setHost] = useState("");
    const aliases = Array.isArray(site.aliases) ? site.aliases : [];
    const locales = localesOf(file);
    const defaultCode = typeof file.defaultLocale === "string" ? file.defaultLocale : (locales[0]?.code ?? "en");
    const otherCode = locales.find((locale) => locale.code !== defaultCode)?.code ?? "fr";
    const mode = PREFIX_MODES.includes(site.localePrefix)
        ? site.localePrefix
        : "except-default";
    const inPath = site.previewLocaleParam === false;
    const addable = HOST_PATTERN.test(host.trim()) && !aliases.includes(host.trim());
    const setAliases = (next) => set("aliases", next.length === 0 ? undefined : next);
    return (_jsxs("div", { className: "flex flex-col gap-12", "data-testid": "site-settings", children: [_jsx(Section, { wide: true, title: t("site.identityTitle"), children: _jsxs("div", { className: "flex flex-col gap-6", children: [_jsx(TextInput, { label: ts("site.name"), value: site.name, onChange: (value) => set("name", orUndefined(value)) }), _jsx(TextInput, { label: t("site.home"), placeholder: "/", value: site.home, onChange: (value) => set("home", orUndefined(value)) })] }) }), _jsx(Section, { wide: true, title: t("site.previewTitle"), children: _jsxs("div", { className: "flex flex-col gap-6", children: [_jsx(TextInput, { label: t("site.previewPath"), placeholder: "/preview", value: site.previewPath, onChange: (value) => set("previewPath", orUndefined(value)) }), _jsx(TextInput, { label: t("site.previewParam"), placeholder: "locale", value: typeof site.previewLocaleParam === "string" ? site.previewLocaleParam : "", onChange: (value) => set("previewLocaleParam", orUndefined(value)) }), _jsx(FlagSwitch, { label: t("site.previewInPath"), checked: inPath, onChange: (on) => set("previewLocaleParam", on ? false : undefined) })] }) }), _jsxs(Section, { wide: true, title: t("site.addressTitle"), children: [_jsx("div", { className: "flex flex-col gap-2", children: _jsx(Pick, { label: t("site.localePrefix"), control: "wide", value: mode, items: PREFIX_MODES.map((value) => ({
                                value,
                                label: t(`site.prefix.${value}`),
                                description: t(`site.prefix.${value}.text`, { default: defaultCode, other: otherCode }),
                            })), onChange: (value) => set("localePrefix", value) }) }), _jsxs("div", { className: "flex flex-col gap-2 border-t pt-6", children: [_jsx(Labeled, { label: t("site.aliases"), control: "normal", children: _jsx("ul", { className: aliases.length > 0 ? "flex flex-col divide-y overflow-hidden rounded-md border" : "hidden", children: aliases.map((alias, index) => (_jsxs("li", { className: "flex items-center gap-2 px-3 py-1", "data-testid": `alias-${alias}`, children: [_jsx("code", { className: "flex-1 text-xs", children: alias }), _jsx(RowActions, { index: index, count: aliases.length, name: alias, onMove: (delta) => setAliases(moveItem(aliases, index, delta)), onRemove: () => setAliases(aliases.filter((_, at) => at !== index)) })] }, alias))) }) }), !disabled && (_jsxs("div", { className: "flex max-w-xl items-end gap-2", children: [_jsx(Input, { className: "flex-1", value: host, "aria-label": t("site.alias.new"), placeholder: "www.example.com", onChange: (event) => setHost(event.target.value) }), _jsx(Button, { type: "button", variant: "outline", size: "sm", disabled: !addable, onClick: () => {
                                            setAliases([...aliases, host.trim()]);
                                            setHost("");
                                        }, children: t("site.alias.add") })] }))] }), _jsx("div", { className: "border-t pt-6", "data-testid": "site-url", children: _jsx(Labeled, { label: t("site.url"), description: t(URL_NOTE[siteUrl.from]), control: "normal", children: siteUrl.url ? (_jsx("code", { className: "block rounded-md bg-monti-muted px-3 py-2 text-xs", children: siteUrl.url })) : null }) })] })] }));
}
