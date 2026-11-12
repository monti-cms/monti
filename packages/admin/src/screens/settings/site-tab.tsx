import type { LocalesDefinition } from "@monti-cms/core";
import { FormField, FormFieldLabel, FormFieldWas, Input, LockMark, ReadValue, Section, Textarea } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { PickOne } from "./pick-one";
import { at } from "./schema-draft";
import { useCell } from "./use-cell";
import type { SettingsDraft } from "./use-settings-draft";

const PREFIXES = ["always", "exceptSource", "never"] as const satisfies readonly LocalesDefinition["prefix"][];

/**
 * Settings › site (doc 12, flow 11 steps 15 and 15b): the site's name and how it writes, admin values that change on the live site too, and how
 * public addresses show the language, a structure value that is text with a lock on the live site.
 */
export function SiteTab({ model }: { model: SettingsDraft }) {
	const { t, siteNameDefault } = useAdmin();
	const { draft } = model;
	const cell = useCell(model);
	const name = cell(at.site("name"));
	const writing = cell(at.site("writing"));
	const prefix = cell(at.localePrefix);
	const prefixLabel = (value: unknown) => t(`settings.site.prefix.${String(value)}`);
	return (
		<>
			<Section title={t("settings.site.nameSection")}>
				<FormField>
					<FormFieldLabel htmlFor="site-name" changed={name.changed}>
						{t("settings.site.name")}
					</FormFieldLabel>
					<Input
						id="site-name"
						value={String(name.value ?? "")}
						placeholder={siteNameDefault}
						proposal={name.proposal}
						onChange={(event) => draft.set(at.site("name"), event.target.value)}
					/>
					{name.proposal && name.was ? <FormFieldWas>{String(name.was)}</FormFieldWas> : null}
				</FormField>
			</Section>
			<Section title={t("settings.site.writingSection")}>
				<FormField>
					<FormFieldLabel htmlFor="site-writing" changed={writing.changed}>
						{t("settings.site.writing")}
					</FormFieldLabel>
					<Textarea
						id="site-writing"
						rows={3}
						value={String(writing.value ?? "")}
						proposal={writing.proposal}
						onChange={(event) => draft.set(at.site("writing"), event.target.value)}
					/>
					{writing.proposal && writing.was ? <FormFieldWas>{String(writing.was)}</FormFieldWas> : null}
				</FormField>
			</Section>
			<Section title={t("settings.site.addressSection")} last>
				{model.locked ? (
					<ReadValue label={t("settings.site.prefix")} mono={false}>
						{prefixLabel(prefix.value)}
						<LockMark label={t("settings.locked")} />
					</ReadValue>
				) : (
					<FormField>
						<FormFieldLabel htmlFor="site-prefix" changed={prefix.changed}>
							{t("settings.site.prefix")}
						</FormFieldLabel>
						<PickOne
							id="site-prefix"
							items={PREFIXES.map((value) => ({ value, label: prefixLabel(value) }))}
							value={String(prefix.value)}
							proposal={prefix.proposal}
							onChange={(value) => draft.set(at.localePrefix, value)}
						/>
						{prefix.proposal ? <FormFieldWas>{prefixLabel(prefix.was)}</FormFieldWas> : null}
					</FormField>
				)}
			</Section>
		</>
	);
}
