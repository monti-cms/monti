"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	Dialog,
	DialogContent,
	DialogFormFooter,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	Inline,
	Input,
	LanguageRow,
	LanguageRowHandle,
	LanguageSource,
	LockMark,
	MenuShortcut,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Section,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { useId, useMemo, useState } from "react";
import { commonMessages } from "../../lib/common.messages";
import { moveWithin } from "../../lib/utils/move-within";
import { Labeled } from "../shared/labeled";
import { schemaChangesMessages } from "./changes.messages";
import { useFieldChange, useSchemaEdit } from "./controls";
import { SortableList } from "./fields-tree-dnd";
import { customLocaleCode, findLocaleCodes, localeFromCode, localeName, sourceFirst } from "./locale-names";
import { schemaLocalesMessages } from "./locales.messages";
import { schemaMessages } from "./messages";
import { ReadValue } from "./read-value";
import { type Locale, localesOf, type Obj, sameJson, setProp } from "./schema-model";

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
	revert,
}: {
	value: string | undefined;
	onChange: (value: string | undefined) => void;
	revert?: () => void;
}) {
	const t = useTranslator(schemaLocalesMessages);
	const { disabled } = useSchemaEdit();
	const id = useId();
	const zones = useMemo(() => zonesWith(value), [value]);
	const changed = useFieldChange(t("locales.timeZone"), revert);
	if (disabled) return <ReadValue label={t("locales.timeZone")}>{value ?? ""}</ReadValue>;
	return (
		<Labeled label={t("locales.timeZone")} htmlFor={id} changed={changed}>
			<Combobox
				items={zones}
				autoHighlight
				disabled={disabled}
				value={value ?? null}
				onValueChange={(next: string | null) => onChange(next ?? undefined)}
			>
				<ComboboxInput id={id} mono aria-label={t("locales.timeZone")} placeholder="Asia/Seoul" disabled={disabled} />
				<ComboboxContent>
					<ComboboxEmpty>{t("locales.timeZoneNone")}</ComboboxEmpty>
					<ComboboxList>
						{(zone: string) => (
							<ComboboxItem key={zone} value={zone}>
								<Inline as="span" grow justify="between" gap={8} minWidth={0}>
									<Text truncate>{zone}</Text>
									<Text variant="caption" tone="muted">
										{offsetOf(zone)}
									</Text>
								</Inline>
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Labeled>
	);
}

/** The small window that asks once for a language the list does not know: the code is the one typed, the two names are typed here. */
function CustomLocaleDialog({
	code,
	onAdd,
	onClose,
}: {
	code: string;
	onAdd: (locale: Locale) => void;
	onClose: () => void;
}) {
	const t = useTranslator(schemaLocalesMessages);
	const tc = useTranslator(commonMessages);
	const nameId = useId();
	const labelId = useId();
	const [name, setName] = useState("");
	const [label, setLabel] = useState("");
	const ok = name.trim() !== "" && label.trim() !== "";
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent data-testid="locale-dialog" form>
				<DialogHeader>
					<DialogTitle of={code}>{t("locales.newTitle")}</DialogTitle>
				</DialogHeader>
				<Stack
					as="form"
					gap={24}
					onSubmit={(event) => {
						event.preventDefault();
						if (ok)
							onAdd({ code, name: name.trim(), ...(label.trim() === name.trim() ? {} : { label: label.trim() }) });
					}}
				>
					<Stack gap={16}>
						<ReadValue label={t("locales.code")}>{code}</ReadValue>
						<Labeled label={t("locales.name")} htmlFor={nameId}>
							<Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} />
						</Labeled>
						<Labeled label={t("locales.label")} htmlFor={labelId}>
							<Input id={labelId} value={label} onChange={(event) => setLabel(event.target.value)} />
						</Labeled>
					</Stack>
					<DialogFormFooter onCancel={onClose} cancelLabel={tc("cancel")} submitLabel={tc("add")} disabled={!ok} />
				</Stack>
			</DialogContent>
		</Dialog>
	);
}

/** "add language": a searchable list of language codes. Picking one adds its row at once (the names come from the code); the last row, "type it yourself", asks for the names. */
function AddLocale({
	taken,
	adminLanguage,
	onPick,
	onCustom,
}: {
	taken: readonly string[];
	adminLanguage: string;
	onPick: (code: string) => void;
	onCustom: (code: string) => void;
}) {
	const t = useTranslator(schemaLocalesMessages);
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const codes = useMemo(() => findLocaleCodes(search, taken, adminLanguage), [search, taken, adminLanguage]);
	const custom = customLocaleCode(search, taken, codes);
	const close = () => {
		setOpen(false);
		setSearch("");
	};
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setSearch("");
			}}
		>
			<PopoverTrigger render={<TextButton />}>{t("locales.add")}</PopoverTrigger>
			<PopoverContent align="start" padding="menu">
				<Command shouldFilter={false} label={t("locales.search")}>
					<CommandInput value={search} onValueChange={setSearch} aria-label={t("locales.search")} autoFocus />
					<CommandList label={t("locales.codes")}>
						{codes.length === 0 && !custom && <CommandEmpty>{t("locales.none")}</CommandEmpty>}
						<CommandGroup>
							{codes.map((code) => (
								<CommandItem
									key={code}
									value={code}
									onSelect={() => {
										onPick(code);
										close();
									}}
								>
									<Text variant="caption" mono>
										{code}
									</Text>
									<Text>{localeName(code, code)}</Text>
									<MenuShortcut>{localeName(code, adminLanguage)}</MenuShortcut>
								</CommandItem>
							))}
						</CommandGroup>
						{custom && (
							<>
								{codes.length > 0 && <CommandSeparator alwaysRender />}
								<CommandGroup>
									<CommandItem
										value="custom"
										onSelect={() => {
											onCustom(custom);
											close();
										}}
									>
										<Text>{t("locales.custom")}</Text>
										<MenuShortcut>{custom}</MenuShortcut>
									</CommandItem>
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

/** One language that is not the source: a handle to drag it by and a × that takes it out. */
function OtherRow({
	locale,
	dot,
	editable,
	onRemove,
}: {
	locale: Locale;
	dot?: string;
	editable: boolean;
	onRemove: () => void;
}) {
	const t = useTranslator(schemaLocalesMessages);
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: locale.code,
		disabled: !editable,
	});
	return (
		<LanguageRow
			ref={setNodeRef}
			data-testid={`locale-${locale.code}`}
			name={locale.name}
			code={locale.code}
			label={locale.label}
			dot={dot}
			handled={editable}
			drag={{ transform: CSS.Translate.toString(transform) ?? undefined, transition, active: isDragging }}
			handle={
				editable ? (
					<LanguageRowHandle
						ref={setActivatorNodeRef}
						{...attributes}
						{...listeners}
						aria-label={t("locales.drag", { name: locale.name })}
					/>
				) : undefined
			}
		>
			{editable && (
				<TextButton variant="quiet" aria-label={t("locales.remove", { name: locale.name })} onClick={onRemove}>
					×
				</TextButton>
			)}
		</LanguageRow>
	);
}

/** Where the language keys are written when they are new. */
const FILE_ORDER = ["collections", "migrations", "locales", "defaultLocale", "timeZone"];

/**
 * The content languages and the time zone. Names are never typed: a language row is its code with the names Intl gives it, so there is no input and no edit
 * row. The source language (`defaultLocale`) is pinned on top with the source flag and the change button; the others have a drag handle and a ×. "add language" picks a code from a
 * list and adds the row at once.
 */
export function LocalesEditor({ file, update }: { file: Obj; update: (change: (file: Obj) => Obj) => void }) {
	const t = useTranslator(schemaLocalesMessages);
	const tChanges = useTranslator(schemaChangesMessages);
	const ts = useTranslator(schemaMessages);
	const site = useSite();
	const { disabled, saved } = useSchemaEdit();
	const locales = localesOf(file);
	const savedCodes = localesOf(saved).map((locale) => locale.code);
	const editable = !disabled;
	const sourceCode = typeof file.defaultLocale === "string" ? file.defaultLocale : (locales[0]?.code ?? "");
	const source = locales.find((locale) => locale.code === sourceCode) ?? locales[0];
	const others = locales.filter((locale) => locale.code !== source?.code);
	// A language taken out stays in the list, struck through, until the draft is saved: it sits where it was among the others.
	const goneRows = localesOf(saved)
		.map((locale, index) => ({ locale, index }))
		.filter(({ locale }) => !locales.some((item) => item.code === locale.code));
	const otherRows: { locale: Locale; gone: boolean }[] = others.map((locale) => ({ locale, gone: false }));
	for (const { locale, index } of goneRows)
		otherRows.splice(Math.max(0, Math.min(index - 1, otherRows.length)), 0, { locale, gone: true });
	const sourceMoved = !sameJson(saved.defaultLocale, file.defaultLocale);
	const revertKey = (key: "timeZone") =>
		sameJson(saved[key], file[key])
			? undefined
			: () => update((current) => setProp(current, key, saved[key], FILE_ORDER));
	const [custom, setCustom] = useState<string | null>(null);
	const change = (next: Locale[]) => update((current) => ({ ...current, locales: next }));
	/** The dot of a row: a language that is new, or one of the two whose role as the source changed. */
	const dotOf = (locale: Locale): string | undefined => {
		if (!savedCodes.includes(locale.code)) return tChanges("tag.added");
		if (sourceMoved && (locale.code === sourceCode || locale.code === saved.defaultLocale))
			return t("locales.sourceChanged");
		return undefined;
	};
	const add = (locale: Locale) => change([...locales, locale]);
	const makeSource = (code: string) =>
		update((current) => ({ ...current, defaultLocale: code, locales: sourceFirst(localesOf(current), code) }));
	const onDrop = (from: string, to: string) => {
		const codes = others.map((locale) => locale.code);
		const moved = moveWithin(others, codes.indexOf(from), codes.indexOf(to));
		change(source ? [source, ...moved] : moved);
	};
	return (
		<Stack gap={0}>
			<Section
				title={
					<>
						{t("locales.contentTitle")}
						{!editable && <LockMark label={ts("lock.cannotChange")} />}
					</>
				}
				data-testid="locales-content"
			>
				<Stack gap={0}>
					<Box as="ul">
						{source && (
							<LanguageRow
								data-testid={`locale-${source.code}`}
								name={source.name}
								code={source.code}
								label={source.label}
								dot={dotOf(source)}
								handled={editable}
							>
								<LanguageSource flag={t("locales.source")}>
									{editable && locales.length > 1 && (
										<DropdownMenu>
											<DropdownMenuTrigger render={<TextButton variant="underline" quiet size="note" />}>
												{t("locales.sourceChange")}
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuRadioGroup
													aria-label={t("locales.sourceMenu")}
													value={source.code}
													onValueChange={(code) => makeSource(String(code))}
												>
													{locales.map((locale) => (
														<DropdownMenuRadioItem key={locale.code} value={locale.code}>
															{locale.name}
														</DropdownMenuRadioItem>
													))}
												</DropdownMenuRadioGroup>
											</DropdownMenuContent>
										</DropdownMenu>
									)}
								</LanguageSource>
							</LanguageRow>
						)}
						<SortableList items={others.map((locale) => locale.code)} onDragEnd={onDrop}>
							{otherRows.map(({ locale, gone }) =>
								gone ? (
									<LanguageRow
										key={locale.code}
										data-testid={`gone-locale-${locale.code}`}
										name={locale.name}
										code={locale.code}
										label={locale.label}
										dot={t("locales.removed")}
										gone
										handled={editable}
									/>
								) : (
									<OtherRow
										key={locale.code}
										locale={locale}
										dot={dotOf(locale)}
										editable={editable}
										onRemove={() => change(locales.filter((item) => item.code !== locale.code))}
									/>
								),
							)}
						</SortableList>
					</Box>
					{editable && (
						<Box paddingTop={12}>
							<AddLocale
								taken={locales.map((locale) => locale.code)}
								adminLanguage={site.ADMIN_LANGUAGE}
								onPick={(code) => {
									const locale = localeFromCode(code, site.ADMIN_LANGUAGE);
									if (locale) add(locale);
								}}
								onCustom={setCustom}
							/>
						</Box>
					)}
				</Stack>
			</Section>
			<Section last title={t("locales.timeZoneTitle")}>
				<TimeZonePick
					revert={revertKey("timeZone")}
					value={typeof file.timeZone === "string" ? file.timeZone : undefined}
					onChange={(value) => update((current) => setProp(current, "timeZone", value, FILE_ORDER))}
				/>
			</Section>
			{custom && (
				<CustomLocaleDialog
					key={custom}
					code={custom}
					onClose={() => setCustom(null)}
					onAdd={(locale) => {
						add(locale);
						setCustom(null);
					}}
				/>
			)}
		</Stack>
	);
}
