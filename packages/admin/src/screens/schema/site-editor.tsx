"use client";

import { HOST_PATTERN, useTranslator } from "@monti-cms/core/client";
import type { SiteUrlState } from "@monti-cms/core/schema-edit";
import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Labeled } from "../shared/labeled";
import { Section } from "../shared/section";
import { FlagSwitch, orUndefined, Pick, RowActions, TextInput, useSchemaEdit } from "./controls";
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
			<Section wide title={t("site.identityTitle")} description={t("site.identityDescription")}>
				<div className="flex flex-col gap-6">
					<TextInput
						label={ts("site.name")}
						hint={t("site.nameHint")}
						value={site.name as string | undefined}
						onChange={(value) => set("name", orUndefined(value))}
					/>
					<TextInput
						label={t("site.home")}
						hint={t("site.homeHint")}
						placeholder="/"
						value={site.home as string | undefined}
						onChange={(value) => set("home", orUndefined(value))}
					/>
				</div>
			</Section>
			<Section wide title={t("site.previewTitle")} description={t("site.previewDescription")}>
				<div className="flex flex-col gap-6">
					<TextInput
						label={t("site.previewPath")}
						hint={t("site.previewPathHint")}
						placeholder="/preview"
						value={site.previewPath as string | undefined}
						onChange={(value) => set("previewPath", orUndefined(value))}
					/>
					<TextInput
						label={t("site.previewParam")}
						hint={t("site.previewParamHint")}
						placeholder="locale"
						value={typeof site.previewLocaleParam === "string" ? site.previewLocaleParam : ""}
						onChange={(value) => set("previewLocaleParam", orUndefined(value))}
					/>
					<FlagSwitch
						label={t("site.previewInPath")}
						hint={t("site.previewInPathHint")}
						checked={inPath}
						onChange={(on) => set("previewLocaleParam", on ? false : undefined)}
					/>
				</div>
			</Section>
			<Section wide title={t("site.addressTitle")} description={t("site.addressDescription")}>
				<div className="flex flex-col gap-2">
					<Pick
						label={t("site.localePrefix")}
						hint={t("site.localePrefixHint")}
						control="wide"
						value={mode}
						items={PREFIX_MODES.map((value) => ({
							value,
							label: t(`site.prefix.${value}`),
							description: t(`site.prefix.${value}.text`, { default: defaultCode, other: otherCode }),
						}))}
						onChange={(value) => set("localePrefix", value)}
					/>
					<p className="max-w-[70ch] text-cms-muted-foreground text-xs" data-testid="locale-prefix-explanations">
						{t(`site.prefix.${mode}.text`, { default: defaultCode, other: otherCode })}
					</p>
				</div>
				<div className="flex flex-col gap-2 border-t pt-6">
					<Labeled label={t("site.aliases")} hint={t("site.aliasesHint")} control="normal">
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
				<div className="border-t pt-6">
					<Labeled label={t("site.url")} hint={t("site.urlHint")} control="normal">
						<div className="flex flex-col gap-0.5 rounded-md bg-cms-muted px-3 py-2 text-sm" data-testid="site-url">
							{siteUrl.url && <code className="text-xs">{siteUrl.url}</code>}
							<span className="text-cms-muted-foreground text-xs">{t(URL_NOTE[siteUrl.from])}</span>
						</div>
					</Labeled>
				</div>
			</Section>
		</div>
	);
}
