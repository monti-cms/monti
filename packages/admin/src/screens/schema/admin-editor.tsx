"use client";

import { useTranslator } from "@monti-cms/core/client";
import { FlagSwitch, Labeled, Pick } from "./controls";
import { schemaMessages } from "./messages";
import { type Obj, sectionOf, setSetting } from "./schema-model";

const DEFAULT_CHOICE = "__default";
const DEFAULT_ADMIN_PATH = "/admin";

/** The languages the admin has a dictionary for (its own text is translated into these; any other locale falls back to English). */
const dictionaryLanguages = Object.keys(schemaMessages.messages);

/** A language written in itself (`한국어 (ko)`), falling back to the code. */
function languageName(code: string): string {
	try {
		const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
		return name && name !== code ? `${name} (${code})` : code;
	} catch {
		return code;
	}
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
		<div className="flex flex-col gap-4" data-testid="admin-settings">
			<p className="text-cms-muted-foreground text-xs">{t("admin.hint")}</p>
			<Pick
				label={t("admin.locale")}
				hint={t("admin.localeHint")}
				value={locale ?? DEFAULT_CHOICE}
				items={[
					{ value: DEFAULT_CHOICE, label: t("admin.localeDefault", { code: defaultCode }) },
					...languages.map((code) => ({ value: code, label: languageName(code) })),
				]}
				onChange={(value) => set("locale", value === DEFAULT_CHOICE ? undefined : value)}
				className="sm:max-w-xs"
			/>
			<FlagSwitch
				label={t("admin.templates")}
				hint={t("admin.templatesHint")}
				checked={admin.templates !== false}
				onChange={(on) => set("templates", on ? undefined : false)}
			/>
			<FlagSwitch
				label={t("admin.translations")}
				hint={t("admin.translationsHint")}
				checked={admin.translations !== false}
				onChange={(on) => set("translations", on ? undefined : false)}
			/>
			<Labeled label={t("admin.path")} hint={t("admin.pathNote")}>
				<code className="w-fit rounded-md border bg-cms-muted/40 px-2.5 py-1.5 text-xs" data-testid="admin-path">
					{path}
				</code>
			</Labeled>
		</div>
	);
}
