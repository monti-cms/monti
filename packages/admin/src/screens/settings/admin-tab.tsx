import { ADMIN_LANGUAGES, type AdminLanguage } from "@monti-cms/core";
import {
	FormField,
	FormFieldLabel,
	MenuShortcut,
	Option,
	ReadValue,
	Section,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	Switch,
	TextButton,
	toast,
} from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { useOperation } from "../../operations/use-operation";
import { useSession } from "../../session";
import { languageName } from "./language-catalog";

/**
 * Settings › admin (doc 12): the admin screen's own language and its feature switches, saved the moment they are picked (no draft, so this tab never
 * holds a change), and the signed-in account with the way out.
 */
export function AdminTab() {
	const { t, language, templates } = useAdmin();
	const session = useSession();
	const preference = useOperation("admin.setPreference");
	const signOut = useOperation("auth.signOut");

	// What `auth.state` says is what every screen draws with, so the pick shows once it is read again.
	const set = async (values: { language?: AdminLanguage; templates?: boolean }) => {
		const result = await preference.run(values);
		if (result.ok) await session.reload();
		else toast.error(result.refusal.reason ? t(result.refusal.reason) : t("settings.saveFailed"));
	};

	return (
		<>
			<Section title={t("settings.admin.languageSection")}>
				<FormField>
					<FormFieldLabel htmlFor="admin-language">{t("settings.admin.language")}</FormFieldLabel>
					<Select
						items={ADMIN_LANGUAGES.map((code) => ({ value: code, label: languageName(code, code) }))}
						value={language}
						onValueChange={(code) => code !== null && void set({ language: code as AdminLanguage })}
					>
						<SelectTrigger id="admin-language" width="full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ADMIN_LANGUAGES.map((code) => (
								<SelectItem key={code} value={code}>
									{languageName(code, code)}
									<MenuShortcut>{code}</MenuShortcut>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
			</Section>
			<Section title={t("settings.admin.features")}>
				<Stack gap={4}>
					<Option spread height="lg">
						{t("settings.admin.templates")}
						<Switch checked={templates} onCheckedChange={(checked) => void set({ templates: checked })} />
					</Option>
				</Stack>
			</Section>
			<Section title={t("settings.admin.account")} last>
				<ReadValue label={t("settings.admin.signedInAs")}>{session.state?.session?.who}</ReadValue>
				<TextButton
					loading={signOut.pending}
					onClick={async () => {
						if ((await signOut.run()).ok) await session.reload();
					}}
				>
					{t("settings.admin.signOut")}
				</TextButton>
			</Section>
		</>
	);
}
