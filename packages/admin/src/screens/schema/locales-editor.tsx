"use client";

import { useTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "../../ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "../../ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { Labeled, Pick, TextInput, useSchemaEdit } from "./controls";
import { schemaMessages } from "./messages";
import { collectionsOf, type Locale, localesOf, moveItem, type Obj, sectionOf, setProp } from "./schema-model";
import { Section } from "./section";

/** The IANA time zones the runtime knows, with UTC (which `Intl.supportedValuesOf` leaves out) and the file's own value when it is none of them. */
const zonesWith = (current: string | undefined): string[] => {
	let known: string[] = [];
	try {
		known = Intl.supportedValuesOf("timeZone");
	} catch {
		// an old runtime: the list is the current value and UTC
	}
	return [...new Set(["UTC", ...known, ...(current ? [current] : [])])].sort((a, b) =>
		a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b),
	);
};

/** `UTC+9` for a zone, as of now (it is what people compare zones by). */
function offsetOf(zone: string): string {
	try {
		const part = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" })
			.formatToParts(new Date())
			.find((item) => item.type === "timeZoneName");
		return part ? part.value.replace("GMT", "UTC") : "";
	} catch {
		return "";
	}
}

/** A searchable list of time zones; clearing it removes `timeZone` from the file (UTC applies). */
function TimeZonePick({
	value,
	onChange,
}: {
	value: string | undefined;
	onChange: (value: string | undefined) => void;
}) {
	const t = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	const id = useId();
	const zones = useMemo(() => zonesWith(value), [value]);
	return (
		<Labeled label={t("locales.timeZone")} hint={t("locales.timeZoneHelp")} htmlFor={id}>
			<Combobox
				items={zones}
				autoHighlight
				disabled={disabled}
				value={value ?? null}
				onValueChange={(next: string | null) => onChange(next ?? undefined)}
			>
				<ComboboxInput
					id={id}
					aria-label={t("locales.timeZone")}
					placeholder="Asia/Seoul"
					showClear={value !== undefined}
					disabled={disabled}
					className="w-full"
				/>
				<ComboboxContent>
					<ComboboxEmpty>{t("locales.timeZoneNone")}</ComboboxEmpty>
					<ComboboxList>
						{(zone: string) => (
							<ComboboxItem key={zone} value={zone}>
								<span className="truncate">{zone}</span>
								<span className="ml-auto text-cms-muted-foreground text-xs">{offsetOf(zone)}</span>
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Labeled>
	);
}

const CODE = /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/;

/** The dialog that adds a language or edits one. The code of a saved language is a stored value, so editing shows it but does not change it. */
function LocaleDialog({
	locale,
	taken,
	onSave,
	onClose,
}: {
	/** The language being edited; none: a new one. */
	locale?: Locale;
	taken: readonly string[];
	onSave: (locale: Locale) => void;
	onClose: () => void;
}) {
	const t = useTranslator(schemaMessages);
	const [code, setCode] = useState(locale?.code ?? "");
	const [name, setName] = useState(locale?.name ?? "");
	const [label, setLabel] = useState(locale?.label ?? "");
	const codeOk = locale !== undefined || (CODE.test(code) && !taken.includes(code));
	const ok = codeOk && name.trim() !== "";
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md" data-testid="locale-dialog">
				<DialogHeader>
					<DialogTitle>{locale ? t("locales.editTitle", { name: locale.name }) : t("locales.addTitle")}</DialogTitle>
					<DialogDescription>{t("locales.contentNote")}</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-6"
					onSubmit={(event) => {
						event.preventDefault();
						if (!ok) return;
						onSave({ code, name: name.trim(), ...(label.trim() ? { label: label.trim() } : {}) });
					}}
				>
					<Labeled label={t("locales.code")} hint={locale ? undefined : t("locales.codeHint")}>
						<Input
							autoFocus={!locale}
							value={code}
							disabled={locale !== undefined}
							aria-label={t("locales.code")}
							placeholder="en"
							aria-invalid={code !== "" && !codeOk ? true : undefined}
							onChange={(event) => setCode(event.target.value)}
						/>
					</Labeled>
					<Labeled label={t("locales.name")}>
						<Input
							autoFocus={locale !== undefined}
							value={name}
							aria-label={t("locales.name")}
							placeholder="English"
							onChange={(event) => setName(event.target.value)}
						/>
					</Labeled>
					<Labeled label={t("locales.label")} hint={t("locales.labelHint")}>
						<Input value={label} aria-label={t("locales.label")} onChange={(event) => setLabel(event.target.value)} />
					</Labeled>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							{t("locales.cancel")}
						</Button>
						<Button type="submit" disabled={!ok}>
							{locale ? t("locales.save") : t("locales.add")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** A public address of the first collection that has one, with `:slug` filled in: the example the language settings show. */
function examplePath(file: Obj): string {
	for (const collection of Object.values(collectionsOf(file))) {
		if (typeof collection.path === "string" && collection.path.startsWith("/"))
			return collection.path.replace(":slug", "hello");
	}
	return "/posts/hello";
}

const PREFIX_MODES = ["except-default", "always", "never"] as const;

/** The content languages (code, name, admin name) as one list, the default one, and the time zone. A saved language's code is a stored value, so it is not editable; add a new language instead. */
export function LocalesEditor({
	file,
	update,
}: {
	file: Obj;
	/** The codes in the file on disk (kept for callers; a code never changes after it is added). */
	savedCodes?: readonly string[];
	update: (change: (file: Obj) => Obj) => void;
}) {
	const t = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	const locales = localesOf(file);
	const [dialog, setDialog] = useState<{ code: string | null } | null>(null);
	const change = (next: Locale[]) => update((current) => ({ ...current, locales: next }));
	const defaultLocale = typeof file.defaultLocale === "string" ? file.defaultLocale : "";
	const taken = locales.map((locale) => locale.code);
	const editing = dialog?.code ? locales.find((locale) => locale.code === dialog.code) : undefined;
	const mode = PREFIX_MODES.find((value) => value === sectionOf(file, "site").localePrefix) ?? "except-default";
	const other = locales.find((locale) => locale.code !== defaultLocale)?.code ?? "en";
	const menu = (locale: Locale, index: number): MenuAction[] => [
		{
			kind: "item",
			label: t("locales.edit"),
			icon: Pencil,
			disabled,
			onSelect: () => setDialog({ code: locale.code }),
		},
		{
			kind: "item",
			label: t("row.up", { name: locale.code }),
			icon: ArrowUp,
			disabled: disabled || index === 0,
			onSelect: () => change(moveItem(locales, index, -1)),
		},
		{
			kind: "item",
			label: t("row.down", { name: locale.code }),
			icon: ArrowDown,
			disabled: disabled || index === locales.length - 1,
			onSelect: () => change(moveItem(locales, index, 1)),
		},
		{ kind: "separator" },
		{
			kind: "item",
			label: t("row.remove", { name: locale.code }),
			icon: Trash2,
			destructive: true,
			disabled,
			onSelect: () => change(locales.filter((_, at) => at !== index)),
		},
	];
	return (
		<div className="flex flex-col gap-12">
			<Section
				wide
				card={false}
				title={t("locales.contentTitle")}
				description={t("locales.contentDescription")}
				note={t("locales.contentNote")}
				testId="locales-content"
			>
				<div className="overflow-hidden rounded-lg border bg-cms-card">
					<div className="flex items-center justify-between gap-4 border-b px-4 py-3">
						<span className="text-cms-muted-foreground text-sm">{t("locales.count", { count: locales.length })}</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={disabled}
							onClick={() => setDialog({ code: null })}
						>
							<Plus aria-hidden />
							{t("locales.add")}
						</Button>
					</div>
					<ul className="divide-y">
						{locales.map((locale, index) => (
							<li
								key={locale.code}
								className="flex min-h-14 items-center gap-3.5 px-4 py-2"
								data-testid={`locale-${locale.code}`}
							>
								<span className="flex h-6 min-w-9 items-center justify-center rounded-sm bg-cms-muted px-1.5 font-mono text-xs">
									{locale.code}
								</span>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="truncate font-medium text-sm">{locale.name}</span>
										{locale.code === defaultLocale && (
											<span className="rounded-sm bg-cms-primary/10 px-1.5 py-px text-cms-primary text-xs">
												{t("locales.defaultBadge")}
											</span>
										)}
									</div>
									<div className="truncate text-cms-muted-foreground text-xs">
										{t("locales.adminName", { label: locale.label ?? locale.name })}
									</div>
								</div>
								<MoreActionsButton
									actions={menu(locale, index)}
									label={t("locales.menu", { name: locale.name })}
									className="size-7 shrink-0 text-cms-muted-foreground"
								/>
							</li>
						))}
					</ul>
				</div>
			</Section>
			<Section
				wide
				title={t("locales.defaultTitle")}
				description={t("locales.defaultDescription")}
				testId="locales-default"
			>
				<div className="flex max-w-md flex-col gap-6">
					<Pick
						label={t("locales.default")}
						hint={t(`locales.addresses.${mode}`, { default: defaultLocale, other, path: examplePath(file) })}
						value={defaultLocale}
						items={locales.map((locale) => ({
							value: locale.code,
							label: `${locale.label ?? locale.name} (${locale.code})`,
						}))}
						onChange={(value) => update((current) => ({ ...current, defaultLocale: value }))}
					/>
					<TimeZonePick
						value={typeof file.timeZone === "string" ? file.timeZone : undefined}
						onChange={(value) =>
							update((current) =>
								setProp(current, "timeZone", value, [
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
			</Section>
			{dialog && (
				<LocaleDialog
					key={dialog.code ?? "new"}
					locale={editing}
					taken={taken}
					onClose={() => setDialog(null)}
					onSave={(locale) => {
						change(
							editing ? locales.map((item) => (item.code === editing.code ? locale : item)) : [...locales, locale],
						);
						setDialog(null);
					}}
				/>
			)}
		</div>
	);
}
