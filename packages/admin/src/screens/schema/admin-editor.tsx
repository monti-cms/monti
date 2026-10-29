"use client";

import { DEFAULT_ADMIN_PATH, languageName, useTranslator } from "@monti-cms/core/site";
import { Box, Section, Stack } from "@monti-cms/ui";
import { schemaAdminMessages } from "./admin.messages";
import { FlagSwitch, Pick, useSettingRevert } from "./controls";
import { ReadValue } from "./read-value";
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
		<Stack gap={0} data-testid="admin-settings">
			<Section title={t("admin.languageTitle")}>
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
			</Section>
			<Section title={t("admin.featuresTitle")}>
				<FlagSwitch
					label={t("admin.templates")}
					revert={revert("templates")}
					checked={admin.templates !== false}
					onChange={(on) => set("templates", on ? undefined : false)}
				/>
				<FlagSwitch
					label={t("admin.translations")}
					revert={revert("translations")}
					checked={admin.translations !== false}
					onChange={(on) => set("translations", on ? undefined : false)}
				/>
			</Section>
			<Section title={t("admin.addressTitle")}>
				<ReadValue label={t("admin.path")}>
					<Box as="span" data-testid="admin-path">
						{path}
					</Box>
				</ReadValue>
			</Section>
		</Stack>
	);
}
