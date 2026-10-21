"use client";

import type { SiteUrlState } from "@monti-cms/core/internal/schema-edit";
import { HOST_PATTERN, useTranslator } from "@monti-cms/core/site";
import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Labeled } from "../shared/labeled";
import { Section } from "../shared/section";
import {
	FlagSwitch,
	orUndefined,
	Pick,
	RevertMark,
	RowActions,
	TextInput,
	useSchemaEdit,
	useSettingRevert,
} from "./controls";
import { schemaMessages } from "./messages";
import { localesOf, moveItem, type Obj, sectionOf, setSetting } from "./schema-model";
import { schemaSiteMessages } from "./site.messages";

const PREFIX_MODES = ["except-default", "always", "never"] as const;
type PrefixMode = (typeof PREFIX_MODES)[number];

const URL_NOTE = {
	env: "site.url.env",
	schema: "site.url.schema",
	config: "site.url.config",
	none: "site.url.none",
} as const;

/** The `site` settings of the file: name, home link, preview address, how the language shows in addresses, and other host names. The site URL is only shown. */
export function SiteEditor({
	file,
	siteUrl,
	update,
}: {
	file: Obj;
	siteUrl: SiteUrlState;
	update: (change: (file: Obj) => Obj) => void;
}) {
	const t = useTranslator(schemaSiteMessages);
	const ts = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	const site = sectionOf(file, "site");
	const set = (key: string, value: unknown) => update((current) => setSetting(current, "site", key, value));
	const revert = useSettingRevert("site", set);
	const [host, setHost] = useState("");
	const aliases = Array.isArray(site.aliases) ? (site.aliases as string[]) : [];
	const locales = localesOf(file);
	const defaultCode = typeof file.defaultLocale === "string" ? file.defaultLocale : (locales[0]?.code ?? "en");
	const otherCode = locales.find((locale) => locale.code !== defaultCode)?.code ?? "fr";
	const mode = PREFIX_MODES.includes(site.localePrefix as PrefixMode)
		? (site.localePrefix as PrefixMode)
		: "except-default";
	const inPath = site.previewLocaleParam === false;
	const addable = HOST_PATTERN.test(host.trim()) && !aliases.includes(host.trim());
	const setAliases = (next: string[]) => set("aliases", next.length === 0 ? undefined : next);
	return (
		<div className="flex flex-col gap-12" data-testid="site-settings">
			<Section wide band title={t("site.identityTitle")} description={t("site.identityHelp")}>
				<TextInput
					label={ts("site.name")}
					revert={revert("name")}
					value={site.name as string | undefined}
					onChange={(value) => set("name", orUndefined(value))}
				/>
				<TextInput
					label={t("site.home")}
					revert={revert("home")}
					placeholder="/"
					value={site.home as string | undefined}
					onChange={(value) => set("home", orUndefined(value))}
				/>
			</Section>
			<Section wide band title={t("site.previewTitle")} description={t("site.previewHelp")}>
				<TextInput
					label={t("site.previewPath")}
					revert={revert("previewPath")}
					placeholder="/preview"
					value={site.previewPath as string | undefined}
					onChange={(value) => set("previewPath", orUndefined(value))}
				/>
				<TextInput
					label={t("site.previewParam")}
					revert={revert("previewLocaleParam")}
					placeholder="locale"
					value={typeof site.previewLocaleParam === "string" ? site.previewLocaleParam : ""}
					onChange={(value) => set("previewLocaleParam", orUndefined(value))}
				/>
				<FlagSwitch
					label={t("site.previewInPath")}
					revert={revert("previewLocaleParam")}
					checked={inPath}
					onChange={(on) => set("previewLocaleParam", on ? false : undefined)}
				/>
			</Section>
			<Section wide band title={t("site.addressTitle")} description={t("site.addressHelp")}>
				<div className="flex flex-col gap-2">
					<Pick
						label={t("site.localePrefix")}
						revert={revert("localePrefix")}
						control="wide"
						value={mode}
						items={PREFIX_MODES.map((value) => ({
							value,
							label: t(`site.prefix.${value}`),
							description: t(`site.prefix.${value}.text`, { default: defaultCode, other: otherCode }),
						}))}
						onChange={(value) => set("localePrefix", value)}
					/>
				</div>
				<div className="flex flex-col gap-2 border-t pt-6">
					<Labeled
						label={t("site.aliases")}
						control="normal"
						aside={revert("aliases") && <RevertMark name={t("site.aliases")} onRevert={() => revert("aliases")?.()} />}
					>
						<ul className={aliases.length > 0 ? "flex flex-col divide-y overflow-hidden rounded-md border" : "hidden"}>
							{aliases.map((alias, index) => (
								<li key={alias} className="flex items-center gap-2 px-3 py-1" data-testid={`alias-${alias}`}>
									<code className="flex-1 text-xs">{alias}</code>
									<RowActions
										index={index}
										count={aliases.length}
										name={alias}
										onMove={(delta) => setAliases(moveItem(aliases, index, delta))}
										onRemove={() => setAliases(aliases.filter((_, at) => at !== index))}
									/>
								</li>
							))}
						</ul>
					</Labeled>
					{!disabled && (
						<div className="flex max-w-xl items-end gap-2">
							<Input
								className="flex-1"
								value={host}
								aria-label={t("site.alias.new")}
								placeholder="www.example.com"
								onChange={(event) => setHost(event.target.value)}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!addable}
								onClick={() => {
									setAliases([...aliases, host.trim()]);
									setHost("");
								}}
							>
								{t("site.alias.add")}
							</Button>
						</div>
					)}
				</div>
				<div className="border-t pt-6" data-testid="site-url">
					<Labeled label={t("site.url")} description={t(URL_NOTE[siteUrl.from])} control="normal">
						{siteUrl.url ? (
							<code className="block rounded-md bg-monti-muted px-3 py-2 text-xs">{siteUrl.url}</code>
						) : null}
					</Labeled>
				</div>
			</Section>
		</div>
	);
}
