"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DEFAULT_ADMIN_PATH, languageName, useTranslator } from "@monti-cms/core/client";
import { Labeled } from "../shared/labeled.js";
import { Section } from "../shared/section.js";
import { schemaAdminMessages } from "./admin.messages.js";
import { FlagSwitch, Pick } from "./controls.js";
import { sectionOf, setSetting } from "./schema-model.js";
const DEFAULT_CHOICE = "__default";
/** The languages the admin has a dictionary for (its own text is translated into these; any other locale falls back to English). */
const dictionaryLanguages = Object.keys(schemaAdminMessages.messages);
/** A language written in itself (Korean is its own name followed by `(ko)`), falling back to the code. */
function languageLabel(code) {
    const name = languageName(code);
    return name !== code ? `${name} (${code})` : code;
}
/** The `admin` settings of the file: the admin language and the two switches. The admin path is shown, not edited (the route folder has to move with it). */
export function AdminEditor({ file, update }) {
    const t = useTranslator(schemaAdminMessages);
    const admin = sectionOf(file, "admin");
    const set = (key, value) => update((current) => setSetting(current, "admin", key, value));
    const locale = typeof admin.locale === "string" ? admin.locale : undefined;
    const defaultCode = typeof file.defaultLocale === "string" ? file.defaultLocale : "en";
    const languages = locale && !dictionaryLanguages.includes(locale) ? [...dictionaryLanguages, locale] : dictionaryLanguages;
    const path = typeof admin.path === "string" ? admin.path : DEFAULT_ADMIN_PATH;
    return (_jsxs("div", { className: "flex flex-col gap-12", "data-testid": "admin-settings", children: [_jsx(Section, { wide: true, title: t("admin.languageTitle"), description: t("admin.languageDescription"), children: _jsx("div", { children: _jsx(Pick, { label: t("admin.locale"), description: t("admin.localeHint"), value: locale ?? DEFAULT_CHOICE, items: [
                            { value: DEFAULT_CHOICE, label: t("admin.localeDefault", { code: defaultCode }) },
                            ...languages.map((code) => ({ value: code, label: languageLabel(code) })),
                        ], onChange: (value) => set("locale", value === DEFAULT_CHOICE ? undefined : value) }) }) }), _jsxs(Section, { wide: true, title: t("admin.featuresTitle"), description: t("admin.featuresDescription"), children: [_jsx(FlagSwitch, { label: t("admin.templates"), description: t("admin.templatesHint"), checked: admin.templates !== false, onChange: (on) => set("templates", on ? undefined : false) }), _jsx("div", { className: "border-t pt-6", children: _jsx(FlagSwitch, { label: t("admin.translations"), description: t("admin.translationsHint"), checked: admin.translations !== false, onChange: (on) => set("translations", on ? undefined : false) }) })] }), _jsx(Section, { wide: true, title: t("admin.addressTitle"), description: t("admin.addressDescription"), children: _jsx("div", { children: _jsx(Labeled, { label: t("admin.path"), description: t("admin.pathNote"), children: _jsx("code", { className: "w-fit rounded-md bg-cms-muted px-3 py-2 text-sm", "data-testid": "admin-path", children: path }) }) }) })] }));
}
