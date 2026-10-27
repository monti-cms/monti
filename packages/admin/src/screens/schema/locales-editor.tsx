"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LOCALE_CODE, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
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
	cn,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFormFooter,
	DialogHeader,
	DialogTitle,
	Inline,
	Input,
	Panel,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Stack,
	Text,
} from "@monti-cms/ui";
import { ChevronsUpDown, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { commonMessages } from "../../lib/common.messages";
import { moveWithin } from "../../lib/utils/move-within";
import { Labeled } from "../shared/labeled";
import { Section } from "../shared/section";
import { Pick, RevertMark, useSchemaEdit } from "./controls";
import { SortableList } from "./fields-tree-dnd";
import { type RowButton, RowButtons } from "./fields-tree-rows";
import { schemaLocalesMessages } from "./locales.messages";
import { schemaMessages } from "./messages";
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
	return (
		<Labeled
			label={t("locales.timeZone")}
			htmlFor={id}
			aside={revert && <RevertMark name={t("locales.timeZone")} onRevert={revert} />}
		>
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
				/>
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

/** The autonym of a language in its own language (for example the localized name for `ko`), or undefined when the runtime does not know the code. */
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
	const codeId = useId();
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [code, setCode] = useState(locale?.code ?? "");
	const [name, setName] = useState(locale?.name ?? "");
	const [label, setLabel] = useState(locale?.label ?? "");
	const availableCodes = useMemo(
		() => (KNOWN_CODES as readonly string[]).filter((known) => !taken.includes(known)),
		[taken],
	);
	const codeOk = locale !== undefined || (LOCALE_CODE.test(code) && !taken.includes(code));
	const ok = codeOk && name.trim() !== "";

	const handleCodeSelect = (next: string) => {
		setCode(next);
		if (!locale && name.trim() === "") {
			const native = nativeNameOf(next);
			if (native) setName(native);
		}
	};

	const trimmedSearch = search.trim();
	const isCustom =
		trimmedSearch.length > 0 &&
		!availableCodes.includes(trimmedSearch) &&
		LOCALE_CODE.test(trimmedSearch) &&
		!taken.includes(trimmedSearch);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent size="md" data-testid="locale-dialog">
				<DialogHeader>
					<DialogTitle>{locale ? t("locales.editTitle", { name: locale.name }) : t("locales.addTitle")}</DialogTitle>
					{!locale && <DialogDescription>{t("locales.contentNote")}</DialogDescription>}
				</DialogHeader>
				<Stack
					as="form"
					gap={24}
					onSubmit={(event) => {
						event.preventDefault();
						if (!ok) return;
						onSave({ code, name: name.trim(), ...(label.trim() ? { label: label.trim() } : {}) });
					}}
				>
					<Labeled label={t("locales.code")} htmlFor={codeId}>
						{locale !== undefined ? (
							<Input id={codeId} value={code} disabled aria-label={t("locales.code")} />
						) : (
							<Box position="relative">
								<Input
									id={codeId}
									srOnly
									aria-label={t("locales.code")}
									tabIndex={-1}
									value={code}
									onChange={(event) => handleCodeSelect(event.target.value)}
								/>
								<Popover
									open={open}
									onOpenChange={(nextOpen) => {
										setOpen(nextOpen);
										if (!nextOpen) setSearch("");
									}}
								>
									<PopoverTrigger
										render={
											<Button
												type="button"
												variant={code !== "" && !codeOk ? "outline-danger" : "secondary"}
												width="full"
												role="combobox"
												aria-expanded={open}
												autoFocus
											/>
										}
									>
										<Inline as="span" grow justify="between" gap={8} minWidth={0}>
											{code ? (
												<Inline as="span" gap={8} minWidth={0}>
													<Text variant="caption" mono weight="semibold">
														{code}
													</Text>
													{nativeNameOf(code) && (
														<Text variant="caption" tone="muted">
															{nativeNameOf(code)}
														</Text>
													)}
												</Inline>
											) : (
												<Text tone="muted">{t("locales.codePlaceholder")}</Text>
											)}
											<ChevronsUpDown aria-hidden />
										</Inline>
									</PopoverTrigger>
									<PopoverContent align="start" width="anchor" padding="none">
										<Command>
											<CommandInput
												value={search}
												onValueChange={setSearch}
												placeholder={t("locales.codeSearch")}
												aria-label={t("locales.codeSearch")}
												autoFocus
											/>
											<CommandList>
												<CommandEmpty>{t("locales.codeNone")}</CommandEmpty>
												<CommandGroup>
													{availableCodes.map((known) => {
														const native = nativeNameOf(known);
														return (
															<CommandItem
																key={known}
																value={`${known} ${native ?? ""}`}
																data-checked={code === known ? "true" : undefined}
																onSelect={() => {
																	handleCodeSelect(known);
																	setOpen(false);
																}}
															>
																<Text variant="caption" mono weight="semibold">
																	{known}
																</Text>
																{native && (
																	<Text variant="caption" tone="muted">
																		{native}
																	</Text>
																)}
															</CommandItem>
														);
													})}
												</CommandGroup>
												{isCustom && (
													<CommandGroup>
														<CommandItem
															value={trimmedSearch}
															onSelect={() => {
																handleCodeSelect(trimmedSearch);
																setOpen(false);
															}}
														>
															<Plus size={16} aria-hidden />
															<Text>{t("locales.codeCustom", { code: trimmedSearch })}</Text>
														</CommandItem>
													</CommandGroup>
												)}
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
							</Box>
						)}
					</Labeled>
					<Labeled label={t("locales.label")}>
						<Input
							autoFocus={locale !== undefined}
							value={label}
							aria-label={t("locales.label")}
							placeholder={name || "English"}
							onChange={(event) => setLabel(event.target.value)}
						/>
					</Labeled>
					<Labeled label={t("locales.name")}>
						<Input
							value={name}
							aria-label={t("locales.name")}
							placeholder="English"
							onChange={(event) => setName(event.target.value)}
						/>
					</Labeled>
					<DialogFormFooter
						onCancel={onClose}
						cancelLabel={tc("cancel")}
						submitLabel={locale ? tc("save") : t("locales.add")}
						disabled={!ok}
					/>
				</Stack>
			</DialogContent>
		</Dialog>
	);
}

/** One language of the list: a grip to drag it, and its buttons on hover (the same way a field row is reordered). */
function LocaleRow({
	locale,
	isDefault,
	dragDisabled,
	divided,
	buttons,
}: {
	locale: Locale;
	isDefault: boolean;
	dragDisabled: boolean;
	/** A hairline above the row, when it follows another. */
	divided: boolean;
	buttons: RowButton[];
}) {
	const t = useTranslator(schemaLocalesMessages);
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: locale.code,
		disabled: dragDisabled,
	});
	const displayName = locale.label ?? locale.name;
	const hasDistinctNative = Boolean(locale.label && locale.label !== locale.name);
	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn(
				"group/row relative flex min-h-14 items-center gap-monti-12 bg-monti-page py-monti-8 pr-monti-16 pl-monti-32",
				divided && "border-t",
				isDragging && "z-10 opacity-80 shadow-monti-floating",
			)}
			data-testid={`locale-${locale.code}`}
		>
			<button
				type="button"
				ref={setActivatorNodeRef}
				{...attributes}
				{...listeners}
				aria-label={t("locales.drag", { name: displayName })}
				disabled={dragDisabled}
				className="absolute top-1/2 left-2.5 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-monti-sm text-monti-muted opacity-0 outline-none hover:text-monti-default focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-monti-contrast/20 disabled:hidden group-hover/row:opacity-100"
			>
				<GripVertical aria-hidden className="size-4" />
			</button>
			<Box as="span" radius="sm" background="muted" paddingX={8}>
				<Text variant="caption" mono>
					{locale.code}
				</Text>
			</Box>
			<Stack gap={0} grow minWidth={0}>
				<Inline gap={8}>
					<Text weight="medium" truncate>
						{displayName}
					</Text>
					{isDefault && (
						<Box as="span" radius="sm" background="selected" paddingX={8}>
							<Text variant="caption">{t("locales.defaultBadge")}</Text>
						</Box>
					)}
				</Inline>
				{hasDistinctNative && (
					<Text as="div" variant="caption" tone="muted" truncate>
						{t("locales.nativeName", { name: locale.name })}
					</Text>
				)}
			</Stack>
			<RowButtons buttons={buttons} />
		</li>
	);
}

/** Where the language keys are written when they are new. */
const FILE_ORDER = ["collections", "migrations", "locales", "defaultLocale", "timeZone"];

/** The content languages (code, name, admin name) as one list, the default one, and the time zone. A saved language's code is a stored value, so it is not editable; add a new language instead. */
export function LocalesEditor({ file, update }: { file: Obj; update: (change: (file: Obj) => Obj) => void }) {
	const t = useTranslator(schemaLocalesMessages);
	const ts = useTranslator(schemaMessages);
	const { disabled, saved } = useSchemaEdit();
	const locales = localesOf(file);
	const revertKey = (key: "locales" | "defaultLocale" | "timeZone") =>
		sameJson(saved[key], file[key])
			? undefined
			: () =>
					update((current) =>
						key === "locales" ? { ...current, locales: saved.locales } : setProp(current, key, saved[key], FILE_ORDER),
					);
	const [dialog, setDialog] = useState<{ code: string | null } | null>(null);
	const change = (next: Locale[]) => update((current) => ({ ...current, locales: next }));
	const defaultLocale = typeof file.defaultLocale === "string" ? file.defaultLocale : "";
	const taken = locales.map((locale) => locale.code);
	const editing = dialog?.code ? locales.find((locale) => locale.code === dialog.code) : undefined;
	const buttons = (locale: Locale, index: number): RowButton[] => {
		const isDefault = locale.code === defaultLocale;
		return [
			{
				label: t("locales.editNamed", { name: locale.label ?? locale.name }),
				icon: Pencil,
				disabled,
				onClick: () => setDialog({ code: locale.code }),
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
		<Stack gap={48}>
			<Section wide band card={false} title={t("locales.contentTitle")} testId="locales-content">
				<Panel overflow="hidden">
					<Inline justify="between" gap={16} border="bottom" paddingX={16} paddingY={12}>
						<Inline as="span" gap={8}>
							<Text tone="muted">{t("locales.count", { count: locales.length })}</Text>
							{revertKey("locales") && (
								<RevertMark name={t("locales.contentTitle")} onRevert={() => revertKey("locales")?.()} />
							)}
						</Inline>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							disabled={disabled}
							onClick={() => setDialog({ code: null })}
						>
							<Plus aria-hidden />
							{t("locales.add")}
						</Button>
					</Inline>
					<ul>
						<SortableList items={taken} onDragEnd={onDrop}>
							{locales.map((locale, index) => (
								<LocaleRow
									key={locale.code}
									locale={locale}
									isDefault={locale.code === defaultLocale}
									dragDisabled={disabled}
									divided={index > 0}
									buttons={buttons(locale, index)}
								/>
							))}
						</SortableList>
					</ul>
				</Panel>
			</Section>
			<Section wide band title={t("locales.defaultTitle")} testId="locales-default">
				<Pick
					label={t("locales.default")}
					revert={revertKey("defaultLocale")}
					value={defaultLocale}
					items={locales.map((locale) => ({
						value: locale.code,
						label: `${locale.label ?? locale.name} (${locale.code})`,
					}))}
					onChange={(value) => update((current) => ({ ...current, defaultLocale: value }))}
				/>
				<TimeZonePick
					revert={revertKey("timeZone")}
					value={typeof file.timeZone === "string" ? file.timeZone : undefined}
					onChange={(value) => update((current) => setProp(current, "timeZone", value, FILE_ORDER))}
				/>
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
		</Stack>
	);
}
