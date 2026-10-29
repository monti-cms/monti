"use client";

import type { SiteUrlState } from "@monti-cms/core/internal/schema-edit";
import { useTranslator } from "@monti-cms/core/site";
import { Box, LockMark, Section, Stack, Text } from "@monti-cms/ui";
import { FlagSwitch, orUndefined, Pick, TextInput, useSchemaEdit, useSettingRevert } from "./controls";
import { HostRows } from "./host-rows";
import { schemaMessages } from "./messages";
import { ReadValue } from "./read-value";
import { type Obj, sameJson, sectionOf, setSetting } from "./schema-model";
import { schemaSiteMessages } from "./site.messages";
import { problemAt } from "./site-problems";

const PREFIX_MODES = ["except-default", "always", "never"] as const;
type PrefixMode = (typeof PREFIX_MODES)[number];

/** The `site` settings of the file: name and links, the preview, and the public addresses. The site URL is only shown. */
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
	const { problems, saved, disabled } = useSchemaEdit();
	// What cannot be changed carries the lock beside its title and is written as text, not drawn as a field.
	const lock = disabled ? <LockMark label={ts("lock.cannotChange")} /> : null;
	const site = sectionOf(file, "site");
	const set = (key: string, value: unknown) => update((current) => setSetting(current, "site", key, value));
	const revert = useSettingRevert("site", set);
	const aliases = Array.isArray(site.aliases) ? (site.aliases as string[]) : [];
	const mode = PREFIX_MODES.includes(site.localePrefix as PrefixMode)
		? (site.localePrefix as PrefixMode)
		: "except-default";
	const inPath = site.previewLocaleParam === false;
	const previewPath = typeof site.previewPath === "string" ? site.previewPath : undefined;
	// The switch and the query are one setting in the file: the switch carries the mark when it flipped, the query when only its text changed.
	const savedParam = sectionOf(saved, "site").previewLocaleParam;
	const queryRevert = savedParam === false ? undefined : revert("previewLocaleParam");
	const problemText = (path: string) => {
		const problem = problemAt(problems, path);
		return problem ? t(`problem.${problem.code}` as "problem.query-name") : undefined;
	};
	return (
		<Stack gap={0} data-testid="site-settings">
			<Section title={t("site.identityTitle")}>
				<TextInput
					label={t("site.name")}
					revert={revert("name")}
					value={site.name as string | undefined}
					onChange={(value) => set("name", orUndefined(value))}
				/>
				<HostRows
					hosts={aliases}
					revert={revert("aliases")}
					onChange={(hosts) => set("aliases", hosts.length === 0 ? undefined : hosts)}
				/>
			</Section>
			<Section
				title={
					<>
						{t("site.previewTitle")}
						{lock}
					</>
				}
			>
				<TextInput
					prefix="/"
					label={t("site.previewPath")}
					revert={revert("previewPath")}
					placeholder="preview"
					value={previewPath?.replace(/^\/+/, "")}
					onChange={(value) => {
						const path = value.replace(/^\/+/, "");
						set("previewPath", path === "" ? undefined : `/${path}`);
					}}
				/>
				<FlagSwitch
					label={t("site.previewInPath")}
					revert={revert("previewLocaleParam")}
					checked={inPath}
					onChange={(on) => set("previewLocaleParam", on ? false : undefined)}
				/>
				{!inPath && (
					<TextInput
						mono
						label={t("site.previewParam")}
						revert={sameJson(savedParam, site.previewLocaleParam) ? undefined : queryRevert}
						placeholder="locale"
						value={typeof site.previewLocaleParam === "string" ? site.previewLocaleParam : ""}
						error={problemText("site.previewLocaleParam")}
						onChange={(value) => set("previewLocaleParam", orUndefined(value))}
					/>
				)}
			</Section>
			<Section
				last
				title={
					<>
						{t("site.addressTitle")}
						{lock}
					</>
				}
			>
				<Pick
					label={t("site.localePrefix")}
					revert={revert("localePrefix")}
					value={mode}
					items={PREFIX_MODES.map((value) => ({ value, label: t(`site.prefix.${value}`) }))}
					onChange={(value) => set("localePrefix", value)}
				/>
				<Box data-testid="site-url">
					{siteUrl.url ? (
						<ReadValue label={t("site.url")}>{siteUrl.url}</ReadValue>
					) : (
						<ReadValue label={t("site.url")} mono={false}>
							<Text tone="warning">
								{t("site.url.none.before")}
								<Text mono tone="warning">
									SITE_URL
								</Text>
								{t("site.url.none.after")}
							</Text>
						</ReadValue>
					)}
				</Box>
			</Section>
		</Stack>
	);
}
