"use client";

import { DEFAULT_ADMIN_PATH, languageName, useTranslator } from "@monti-cms/core/client";
import { FlagSwitch, Labeled, Pick } from "./controls";
import { schemaMessages } from "./messages";
import { type Obj, sectionOf, setSetting } from "./schema-model";
import { Section } from "./section";

const DEFAULT_CHOICE = "__default";

/** The languages the admin has a dictionary for (its own text is translated into these; any other locale falls back to English). */
const dictionaryLanguages = Object.keys(schemaMessages.messages);

/** A language written in itself (Korean is its own name followed by `(ko)`), falling back to the code. */
function languageLabel(code: string): string {
	const name = languageName(code);
	return name !== code ? `${name} (${code})` : code;
}

/** The `admin` settings of the file: the admin language and the two switches. The admin path is shown, not edited (the route folder has to move with it). */
export function AdminEditor({ file, update }: { file: Obj; update: (change: (file: Obj) => Obj) => void }) {
	const t = useTranslator(schemaMessages);
	const admin = sectionOf(file, "admin");
	const set = (key: string, value: unknown) => update((current) => setSetting(current, "admin", key, value));
	const locale = typeof admin.locale === "string" ? admin.locale : undefined;
	const defaultCode = typeof file.defaultLocale === "string" ? file.defaultLocale : "en";
	const languages =
		locale && !dictionaryLanguages.includes(locale) ? [...dictionaryLanguages, locale] : dictionaryLanguages;
	const path = typeof admin.path === "string" ? admin.path : DEFAULT_ADMIN_PATH;
	return (
		<div className="flex flex-col gap-12" data-testid="admin-settings">
			<Section wide title={t("admin.languageTitle")} description={t("admin.languageDescription")}>
				<div>
					<Pick
						label={t("admin.locale")}
						hint={t("admin.localeHint")}
						value={locale ?? DEFAULT_CHOICE}
						items={[
							{ value: DEFAULT_CHOICE, label: t("admin.localeDefault", { code: defaultCode }) },
							...languages.map((code) => ({ value: code, label: languageLabel(code) })),
						]}
						onChange={(value) => set("locale", value === DEFAULT_CHOICE ? undefined : value)}
					/>
				</div>
			</Section>
			<Section wide title={t("admin.featuresTitle")} description={t("admin.featuresDescription")}>
				<FlagSwitch
					label={t("admin.templates")}
					hint={t("admin.templatesHint")}
					checked={admin.templates !== false}
					onChange={(on) => set("templates", on ? undefined : false)}
				/>
				<div className="border-t pt-6">
					<FlagSwitch
						label={t("admin.translations")}
						hint={t("admin.translationsHint")}
						checked={admin.translations !== false}
						onChange={(on) => set("translations", on ? undefined : false)}
					/>
				</div>
			</Section>
			<Section wide title={t("admin.addressTitle")} description={t("admin.addressDescription")}>
				<div>
					<Labeled label={t("admin.path")} hint={t("admin.pathNote")}>
						<code className="w-fit rounded-md bg-cms-muted px-3 py-2 text-sm" data-testid="admin-path">
							{path}
						</code>
					</Labeled>
				</div>
			</Section>
		</div>
	);
}
