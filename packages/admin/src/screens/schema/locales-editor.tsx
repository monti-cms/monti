"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fillPattern, LOCALE_CODE, useTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { commonMessages } from "../../lib/common.messages";
import { cn } from "../../lib/utils/cn";
import { moveWithin } from "../../lib/utils/move-within";
import { Button } from "../../ui/button";
import { Panel } from "../../ui/card";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "../../ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { DialogFormFooter } from "../../ui/dialog-form-footer";
import { Input } from "../../ui/input";
import { Labeled } from "../shared/labeled";
import { Section } from "../shared/section";
import { Pick, useSchemaEdit } from "./controls";
import { SortableList } from "./fields-tree-dnd";
import { type RowButton, RowButtons } from "./fields-tree-rows";
import { schemaLocalesMessages } from "./locales.messages";
import { schemaMessages } from "./messages";
import { collectionsOf, type Locale, localesOf, moveItem, type Obj, sectionOf, setProp } from "./schema-model";

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
	const t = useTranslator(schemaLocalesMessages);
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

/** Common language codes offered while typing a code. Any other valid code can still be typed. */
const KNOWN_CODES = [
	"ar",
	"bn",
	"cs",
	"da",
	"de",
	"el",
	"en",
	"es",
	"fa",
	"fi",
	"fr",
	"he",
	"hi",
	"hu",
	"id",
	"it",
	"ja",
	"ko",
	"ms",
	"nl",
	"no",
	"pl",
	"pt",
	"pt-BR",
	"ro",
	"ru",
	"sv",
	"th",
	"tr",
	"uk",
	"vi",
	"zh",
	"zh-CN",
	"zh-TW",
] as const;

/** The name of a language in its own language (`한국어` for `ko`), or undefined when the runtime does not know the code. */
function nativeNameOf(code: string): string | undefined {
	try {
		const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
		return name && name !== code ? name : undefined;
	} catch {
		return undefined;
	}
}

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
	const t = useTranslator(schemaLocalesMessages);
	const tc = useTranslator(commonMessages);
	const codeListId = useId();
	const [code, setCode] = useState(locale?.code ?? "");
	const [name, setName] = useState(locale?.name ?? "");
	const [label, setLabel] = useState(locale?.label ?? "");
	const codeOk = locale !== undefined || (LOCALE_CODE.test(code) && !taken.includes(code));
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
							list={codeListId}
							aria-invalid={code !== "" && !codeOk ? true : undefined}
							onChange={(event) => {
								const next = event.target.value;
								setCode(next);
								// Picking a known code names the language, unless a name was already typed.
								if (!locale && name.trim() === "" && (KNOWN_CODES as readonly string[]).includes(next)) {
									setName(nativeNameOf(next) ?? "");
								}
							}}
						/>
						<datalist id={codeListId}>
							{KNOWN_CODES.filter((known) => !taken.includes(known)).map((known) => (
								<option key={known} value={known}>
									{nativeNameOf(known) ?? known}
								</option>
							))}
						</datalist>
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
					<DialogFormFooter
						onCancel={onClose}
						cancelLabel={tc("cancel")}
						submitLabel={locale ? tc("save") : t("locales.add")}
						disabled={!ok}
					/>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** A public address of the first collection that has one, with `:slug` filled in: the example the language settings show. */
function examplePath(file: Obj): string {
	for (const collection of Object.values(collectionsOf(file))) {
		if (typeof collection.path === "string" && collection.path.startsWith("/"))
			return fillPattern(collection.path, "hello");
	}
	return "/posts/hello";
}

const PREFIX_MODES = ["except-default", "always", "never"] as const;

/** One language of the list: a grip to drag it, and its buttons on hover (the same way a field row is reordered). */
function LocaleRow({
	locale,
	isDefault,
	dragDisabled,
	buttons,
}: {
	locale: Locale;
	isDefault: boolean;
	dragDisabled: boolean;
	buttons: RowButton[];
}) {
	const t = useTranslator(schemaLocalesMessages);
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: locale.code,
		disabled: dragDisabled,
	});
	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn(
				"group/row relative flex min-h-14 items-center gap-3.5 bg-cms-card py-2 pr-4 pl-9",
				isDragging && "z-10 opacity-80 shadow-md",
			)}
			data-testid={`locale-${locale.code}`}
		>
			<button
				type="button"
				ref={setActivatorNodeRef}
				{...attributes}
				{...listeners}
				aria-label={t("locales.drag", { name: locale.name })}
				disabled={dragDisabled}
				className="absolute top-1/2 left-2.5 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-cms-muted-foreground opacity-0 outline-none hover:text-cms-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cms-ring/50 disabled:hidden group-hover/row:opacity-100"
			>
				<GripVertical aria-hidden className="size-4" />
			</button>
			<span className="flex h-6 min-w-9 items-center justify-center rounded-sm bg-cms-muted px-1.5 font-mono text-xs">
				{locale.code}
			</span>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate font-medium text-sm">{locale.name}</span>
					{isDefault && (
						<span className="rounded-sm bg-cms-primary/10 px-1.5 py-px text-cms-primary text-xs">
							{t("locales.defaultBadge")}
						</span>
					)}
				</div>
				<div className="truncate text-cms-muted-foreground text-xs">
					{t("locales.adminName", { label: locale.label ?? locale.name })}
				</div>
			</div>
			<RowButtons buttons={buttons} />
		</li>
	);
}

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
	const t = useTranslator(schemaLocalesMessages);
	const ts = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	const locales = localesOf(file);
	const [dialog, setDialog] = useState<{ code: string | null } | null>(null);
	const change = (next: Locale[]) => update((current) => ({ ...current, locales: next }));
	const defaultLocale = typeof file.defaultLocale === "string" ? file.defaultLocale : "";
	const taken = locales.map((locale) => locale.code);
	const editing = dialog?.code ? locales.find((locale) => locale.code === dialog.code) : undefined;
	const mode = PREFIX_MODES.find((value) => value === sectionOf(file, "site").localePrefix) ?? "except-default";
	const other = locales.find((locale) => locale.code !== defaultLocale)?.code ?? "en";
	const buttons = (locale: Locale, index: number): RowButton[] => {
		const isDefault = locale.code === defaultLocale;
		return [
			{
				label: t("locales.editNamed", { name: locale.name }),
				icon: Pencil,
				disabled,
				onClick: () => setDialog({ code: locale.code }),
			},
			{
				label: ts("row.up", { name: locale.code }),
				icon: ArrowUp,
				disabled: disabled || index === 0,
				onClick: () => change(moveItem(locales, index, -1)),
			},
			{
				label: ts("row.down", { name: locale.code }),
				icon: ArrowDown,
				disabled: disabled || index === locales.length - 1,
				onClick: () => change(moveItem(locales, index, 1)),
			},
			{
				label: ts("row.remove", { name: locale.code }),
				icon: Trash2,
				destructive: true,
				disabled: disabled || isDefault,
				title: isDefault ? t("locales.removeBlockedDefault") : undefined,
				onClick: () => change(locales.filter((_, at) => at !== index)),
			},
		];
	};
	const onDrop = (from: string, to: string) => change(moveWithin(locales, taken.indexOf(from), taken.indexOf(to)));
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
				<Panel className="overflow-hidden">
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
						<SortableList items={taken} onDragEnd={onDrop}>
							{locales.map((locale, index) => (
								<LocaleRow
									key={locale.code}
									locale={locale}
									isDefault={locale.code === defaultLocale}
									dragDisabled={disabled}
									buttons={buttons(locale, index)}
								/>
							))}
						</SortableList>
					</ul>
				</Panel>
			</Section>
			<Section
				wide
				title={t("locales.defaultTitle")}
				description={t("locales.defaultDescription")}
				testId="locales-default"
			>
				<div className="flex flex-col gap-6">
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
