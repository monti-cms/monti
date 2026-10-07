"use client";

import { useTranslator } from "@monti-cms/core/client";
import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Labeled, orUndefined, Pick, RowActions, TextInput, useSchemaEdit } from "./controls";
import { schemaMessages } from "./messages";
import { type Locale, localesOf, moveItem, type Obj, setProp } from "./schema-model";

const CODE = /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/;

/** The content locales (code, name, label), the default one, and the time zone. A saved locale's code is a stored value, so it is not editable; add a new locale instead. */
export function LocalesEditor({
	file,
	savedCodes,
	update,
}: {
	file: Obj;
	/** The codes in the file on disk. */
	savedCodes: readonly string[];
	update: (change: (file: Obj) => Obj) => void;
}) {
	const t = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	const locales = localesOf(file);
	const [code, setCode] = useState("");
	const [name, setName] = useState("");
	const change = (next: Locale[]) => update((current) => ({ ...current, locales: next }));
	const edit = (index: number, patch: Partial<Locale>) =>
		change(
			locales.map((locale, at) => {
				if (at !== index) return locale;
				const merged: Record<string, unknown> = { ...locale, ...patch };
				for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
				return merged as unknown as Locale;
			}),
		);
	const defaultLocale = typeof file.defaultLocale === "string" ? file.defaultLocale : "";
	const taken = locales.map((locale) => locale.code);
	const addable = CODE.test(code) && !taken.includes(code) && name.trim() !== "";
	return (
		<div className="flex flex-col gap-4">
			<p className="text-cms-muted-foreground text-xs">{t("locales.hint")}</p>
			<ul className="flex flex-col gap-2">
				{locales.map((locale, index) => (
					<li
						key={locale.code}
						className="flex flex-wrap items-end gap-2 rounded-lg border p-2.5"
						data-testid={`locale-${locale.code}`}
					>
						<Labeled label={t("locales.code")} className="w-24 flex-none">
							<Input value={locale.code} disabled aria-label={t("locales.code")} />
						</Labeled>
						<TextInput
							label={t("locales.name")}
							value={locale.name}
							className="min-w-32 flex-1"
							onChange={(value) => edit(index, { name: value })}
						/>
						<TextInput
							label={t("locales.label")}
							value={locale.label}
							className="min-w-32 flex-1"
							onChange={(value) => edit(index, { label: orUndefined(value) })}
						/>
						<RowActions
							index={index}
							count={locales.length}
							name={locale.code}
							onMove={(delta) => change(moveItem(locales, index, delta))}
							onRemove={() => {
								change(locales.filter((_, at) => at !== index));
							}}
						/>
						{!savedCodes.includes(locale.code) && (
							<span className="w-full text-cms-muted-foreground text-xs">{t("locales.newHint")}</span>
						)}
					</li>
				))}
			</ul>
			{!disabled && (
				<div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-2">
					<Labeled label={t("locales.newCode")} className="w-28">
						<Input
							value={code}
							aria-label={t("locales.newCode")}
							placeholder="en"
							onChange={(event) => setCode(event.target.value)}
						/>
					</Labeled>
					<Labeled label={t("locales.newName")} className="min-w-32 flex-1">
						<Input
							value={name}
							aria-label={t("locales.newName")}
							placeholder="English"
							onChange={(event) => setName(event.target.value)}
						/>
					</Labeled>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={!addable}
						onClick={() => {
							change([...locales, { code, name }]);
							setCode("");
							setName("");
						}}
					>
						{t("locales.add")}
					</Button>
				</div>
			)}
			<div className="grid gap-3 sm:grid-cols-2">
				<Pick
					label={t("locales.default")}
					hint={t("locales.defaultHint")}
					value={defaultLocale}
					items={locales.map((locale) => ({
						value: locale.code,
						label: `${locale.label ?? locale.name} (${locale.code})`,
					}))}
					onChange={(value) => update((current) => ({ ...current, defaultLocale: value }))}
				/>
				<TextInput
					label={t("locales.timeZone")}
					hint={t("locales.timeZoneHint")}
					placeholder="Asia/Seoul"
					value={file.timeZone as string | undefined}
					onChange={(value) =>
						update((current) =>
							setProp(current, "timeZone", orUndefined(value), [
								"$schema",
								"schemaVersion",
								"collections",
								"migrations",
								"locales",
								"defaultLocale",
							]),
						)
					}
				/>
			</div>
		</div>
	);
}
