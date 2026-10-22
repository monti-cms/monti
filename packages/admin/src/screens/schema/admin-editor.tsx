"use client";

import { DEFAULT_ADMIN_PATH, languageName, useTranslator } from "@monti-cms/core/site";
import { cn } from "@monti-cms/ui";
import { HELP } from "../shared/labeled";
import { Section } from "../shared/section";
import { schemaAdminMessages } from "./admin.messages";
import { FlagSwitch, Pick, useSettingRevert } from "./controls";
import { type Obj, sectionOf, setSetting } from "./schema-model";

const DEFAULT_CHOICE = "__default";

/** The languages the admin has a dictionary for (its own text is translated into these; any other locale falls back to English). */
const dictionaryLanguages = Object.keys(schemaAdminMessages.messages);

/** A language written in itself (Korean is its own name followed by `(ko)`), falling back to the code. */
function languageLabel(code: string): string {
	const name = languageName(code);
	return name !== code ? `${name} (${code})` : code;
}

/** The `admin` settings of the file: the admin language and the two switches. The admin path is shown, not edited (the route folder has to move with it). */
export function AdminEditor({ file, update }: { file: Obj; update: (change: (file: Obj) => Obj) => void }) {
	const t = useTranslator(schemaAdminMessages);
	const admin = sectionOf(file, "admin");
	const set = (key: string, value: unknown) => update((current) => setSetting(current, "admin", key, value));
	const revert = useSettingRevert("admin", set);
	const locale = typeof admin.locale === "string" ? admin.locale : undefined;
	const defaultCode = typeof file.defaultLocale === "string" ? file.defaultLocale : "en";
	const languages =
		locale && !dictionaryLanguages.includes(locale) ? [...dictionaryLanguages, locale] : dictionaryLanguages;
	const path = typeof admin.path === "string" ? admin.path : DEFAULT_ADMIN_PATH;
	return (
		<div className="flex flex-col gap-12" data-testid="admin-settings">
			<Section wide band title={t("admin.languageTitle")}>
				<div>
					<Pick
						label={t("admin.locale")}
						revert={revert("locale")}
						value={locale ?? DEFAULT_CHOICE}
						items={[
							{ value: DEFAULT_CHOICE, label: t("admin.localeDefault", { code: defaultCode }) },
							...languages.map((code) => ({ value: code, label: languageLabel(code) })),
						]}
						onChange={(value) => set("locale", value === DEFAULT_CHOICE ? undefined : value)}
					/>
				</div>
			</Section>
			<Section wide band title={t("admin.featuresTitle")}>
				<FlagSwitch
					label={t("admin.templates")}
					revert={revert("templates")}
					checked={admin.templates !== false}
					onChange={(on) => set("templates", on ? undefined : false)}
				/>
				<div className="border-t pt-6">
					<FlagSwitch
						label={t("admin.translations")}
						revert={revert("translations")}
						checked={admin.translations !== false}
						onChange={(on) => set("translations", on ? undefined : false)}
					/>
				</div>
			</Section>
			<Section wide band title={t("admin.addressTitle")}>
				<div className="flex flex-col gap-2">
					<code className="w-fit rounded-md bg-monti-neutral px-3 py-2 text-monti-body" data-testid="admin-path">
						{path}
					</code>
					<p className={cn(HELP, "text-monti-muted")}>{t("admin.pathNote")}</p>
				</div>
			</Section>
		</div>
	);
}
