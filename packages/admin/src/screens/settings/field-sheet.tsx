import type { FieldDefinition, LocaleMode } from "@monti-cms/core";
import {
	Button,
	DragHandle,
	FormField,
	FormFieldError,
	FormFieldLabel,
	Inline,
	Input,
	LockMark,
	Option,
	OptionRow,
	OptionTable,
	PickList,
	PickListItem,
	ReadValue,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSection,
	SheetSplit,
	SheetTitle,
	Sortable,
	SortableList,
	Stack,
	Switch,
	Text,
	Textarea,
	TextButton,
	useSortableItem,
} from "@monti-cms/ui";
import { type ComponentProps, type ReactNode, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { PickOne } from "./pick-one";
import { at, type DraftField, FIELD_VALUES, type FieldValue, newFieldKey } from "./schema-draft";
import type { CollectionsDraft } from "./use-collections-draft";

/** The four kinds a person makes (doc 01); `slug` is every collection's own and is never made here. */
const KINDS = ["text", "select", "media", "relation"] as const;
const LOCALES = ["same", "perLocale", "fromSource"] as const;
type Kind = (typeof KINDS)[number] | "slug";

/** A field's name: the schema's identifier rule (`checkSchema`), so a wrong one is caught before it is added. */
const IDENTIFIER = /^[a-z][a-zA-Z0-9]*$/;

type Form = {
	kind: Kind;
	name: string;
	label: string;
	description: string;
	multiline: boolean;
	max: string;
	required: boolean;
	locale: LocaleMode;
	options: { value: string; label: string }[];
	many: boolean;
	accept: "image" | "any";
	to: string;
	createMissing: boolean;
};

const blank = (to: string): Form => ({
	kind: "text",
	name: "",
	label: "",
	description: "",
	multiline: false,
	max: "",
	required: false,
	locale: "same",
	options: [],
	many: false,
	accept: "image",
	to,
	createMissing: false,
});

function formOf(field: DraftField, values: Partial<Record<FieldValue, unknown>>, to: string): Form {
	const def = field.def;
	const labels = (values.optionLabels ?? {}) as Record<string, string>;
	return {
		...blank(to),
		kind: def.kind,
		name: field.name,
		label: String(values.label ?? ""),
		description: String(values.description ?? ""),
		multiline: def.kind === "text" && Boolean(def.multiline),
		max: def.kind === "text" && def.max ? String(def.max) : "",
		required: Boolean(def.required),
		locale: def.locale ?? "same",
		options: def.kind === "select" ? def.options.map((value) => ({ value, label: labels[value] ?? "" })) : [],
		many: (def.kind === "select" || def.kind === "relation") && Boolean(def.many),
		accept: def.kind === "media" ? (def.accept ?? "image") : "image",
		to: def.kind === "relation" ? def.to : to,
		createMissing: def.kind === "relation" && Boolean(def.createMissing),
	};
}

/** Drops what is not set, so an untouched field keeps the definition it had (`{ kind: "text" }`, not `{ kind: "text", multiline: false }`). */
const clean = <T,>(value: T): T =>
	Object.fromEntries(Object.entries(value as object).filter(([, each]) => each !== undefined && each !== false)) as T;

function defOf(form: Form, was: FieldDefinition | null): FieldDefinition {
	const common = {
		required: form.required,
		// "All the same" is what a field without a mode does; a mode it had stays written.
		locale: form.locale === "same" && !was?.locale ? undefined : form.locale,
	};
	if (form.kind === "text")
		return clean({
			kind: "text",
			...common,
			multiline: form.multiline,
			max: form.max ? Number(form.max) : undefined,
		});
	if (form.kind === "slug") return clean({ ...(was as FieldDefinition), ...common, kind: "slug" });
	if (form.kind === "select")
		return clean({ kind: "select", ...common, options: form.options.map((option) => option.value), many: form.many });
	if (form.kind === "media")
		return clean({ kind: "media", ...common, accept: form.accept === "any" ? "any" : undefined });
	return clean({ kind: "relation", ...common, to: form.to, many: form.many, createMissing: form.createMissing });
}

const adminOf = (form: Form): Record<FieldValue, unknown> => {
	const labels = Object.fromEntries(
		form.options.filter((option) => option.label).map((option) => [option.value, option.label]),
	);
	return {
		label: form.label || undefined,
		description: form.description || undefined,
		optionLabels: Object.keys(labels).length > 0 ? labels : undefined,
	};
};

/** What the sheet is open on: a new field of a collection, or one of its fields by its place in the draft. */
export type FieldSheetOpen = { collection: string; key: string | null };

const optionId = (index: number) => `o:${index}`;

/** A choice of a select that is dragged by its handle to a new place; without `moveLabel` it stays where it is (structure is locked). */
function SortableOption({
	id,
	moveLabel,
	...row
}: Omit<ComponentProps<typeof OptionRow>, "handle" | "drag" | "ref"> & { id: string; moveLabel?: string }) {
	const item = useSortableItem(id, { disabled: !moveLabel });
	return (
		<OptionRow
			ref={item.ref}
			handle={moveLabel ? <DragHandle {...item.handle} aria-label={moveLabel} /> : undefined}
			drag={{ ...item.motion, active: item.held }}
			{...row}
		/>
	);
}

/**
 * The field sheet (flow 4, step 04; flow 11, step 17b). Adding: pick one of the four kinds, then its settings. Editing a field: the same settings, its
 * kind fixed; changing its name is a rename (the review moves its values). On the live site the structure is text and switches are off; only the view
 * (label, help, option labels) changes. Nothing goes in the draft until the sheet's add or save button.
 */
export function FieldSheet({
	model,
	open,
	onClose,
}: {
	model: CollectionsDraft;
	open: FieldSheetOpen | null;
	onClose: () => void;
}) {
	return (
		<Sheet open={open !== null} onOpenChange={(next) => !next && onClose()}>
			{open ? (
				<FieldSheetBody key={`${open.collection}:${open.key}`} model={model} open={open} onClose={onClose} />
			) : null}
		</Sheet>
	);
}

function FieldSheetBody({
	model,
	open,
	onClose,
}: {
	model: CollectionsDraft;
	open: FieldSheetOpen;
	onClose: () => void;
}) {
	const { t } = useAdmin();
	const { draft, data } = model;
	const c = open.collection;
	const locked = data?.locked ?? true;
	const targets = model.collections
		.filter((each) => draft.value(at.collection(each)))
		.map((each) => ({ value: each, label: model.label(each) }));
	const existing = open.key ? (model.shown(at.field(c, open.key)) as DraftField | null) : null;
	const [form, setForm] = useState<Form>(() =>
		existing
			? formOf(
					existing,
					Object.fromEntries(
						FIELD_VALUES.map((each) => [each, model.shown(at.fieldValue(c, open.key as string, each))]),
					),
					targets[0]?.value ?? "",
				)
			: blank(targets[0]?.value ?? ""),
	);
	const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
	const adding = open.key === null;
	const fixedName = open.key === "title" || open.key === "slug";
	const structure = !locked;

	const keys = model.fields(c);
	const others = keys
		.filter((key) => key !== open.key && draft.value(at.field(c, key)))
		.map((key) => model.fieldName(c, key));
	const nameError = !form.name
		? null
		: !IDENTIFIER.test(form.name)
			? t("settings.field.badName")
			: others.includes(form.name)
				? t("settings.field.nameTaken")
				: null;
	const ready = form.name !== "" && nameError === null;

	const save = () => {
		const key = open.key ?? newFieldKey(keys, form.name);
		if (structure)
			draft.set(at.field(c, key), { name: form.name, def: defOf(form, existing?.def ?? null) } satisfies DraftField);
		const values = adminOf(form);
		for (const each of FIELD_VALUES) {
			const place = at.fieldValue(c, key, each);
			// A new field's empty values are not changes of their own.
			if (values[each] !== undefined || draft.value(place) !== undefined) draft.set(place, values[each]);
		}
		onClose();
	};
	const remove = () => {
		if (open.key) draft.set(at.field(c, open.key), null);
		onClose();
	};

	const lock = <LockMark label={t("settings.locked")} />;
	/**
	 * One input rule: its name at the start, its control at the end. On the live site a rule is in the schema file, so its name carries the lock and its
	 * control is off or reads as text.
	 */
	const rule = (label: ReactNode, control: ReactNode) => (
		<Option spread height="md">
			{structure ? (
				label
			) : (
				<Inline gap={6} align="center">
					{label}
					{lock}
				</Inline>
			)}
			{control}
		</Option>
	);
	const switchRow = (label: ReactNode, checked: boolean, onChange: (checked: boolean) => void) =>
		rule(
			label,
			structure ? (
				<Switch checked={checked} onCheckedChange={onChange} />
			) : (
				<Text tone="subtle">{checked ? t("settings.field.on") : t("settings.field.off")}</Text>
			),
		);
	/** A rule with a few values: a select at the end of the row, or its value as text on the live site. */
	const pickRow = (
		label: ReactNode,
		id: string,
		items: { value: string; label: string }[],
		value: string,
		onChange: (value: string) => void,
	) =>
		rule(
			label,
			structure ? (
				<PickOne id={id} width="fit" size="md" items={items} value={value} onChange={onChange} />
			) : (
				<Text tone="subtle">{items.find((item) => item.value === value)?.label ?? value}</Text>
			),
		);
	const kindWord = (kind: Kind) => t(`settings.field.kind.${kind}`);

	// The identifier is in the schema: renaming it is a rename the review asks about; on the live site it reads as text with the lock.
	const nameField =
		structure && !fixedName ? (
			<FormField>
				<FormFieldLabel htmlFor="field-name">{t("settings.field.name")}</FormFieldLabel>
				<Input
					id="field-name"
					mono
					value={form.name}
					aria-invalid={nameError ? true : undefined}
					onChange={(event) => set({ name: event.target.value })}
				/>
				{nameError ? <FormFieldError>{nameError}</FormFieldError> : null}
			</FormField>
		) : (
			<ReadValue label={t("settings.field.name")}>
				<Inline gap={6} align="center">
					{form.name}
					{lock}
				</Inline>
			</ReadValue>
		);

	// What the field is: the label the admin reads, the identifier the site's code uses, and what it is for, which the assistant reads (doc 10).
	const about = (
		<Stack gap={20}>
			<FormField>
				<FormFieldLabel htmlFor="field-label">{t("settings.field.label")}</FormFieldLabel>
				<Input id="field-label" value={form.label} onChange={(event) => set({ label: event.target.value })} />
			</FormField>
			{nameField}
			<FormField>
				<FormFieldLabel htmlFor="field-about">{t("settings.field.about")}</FormFieldLabel>
				<Textarea
					id="field-about"
					tall
					placeholder={t("settings.field.aboutPlaceholder")}
					value={form.description}
					onChange={(event) => set({ description: event.target.value })}
				/>
			</FormField>
		</Stack>
	);

	const options =
		form.kind === "select" ? (
			<Stack gap={8}>
				<Sortable
					nameOf={(id) => {
						const option = form.options[Number(id.slice(2))];
						return option ? option.value || option.label : "";
					}}
					onDrop={({ active, over }) => {
						if (!over) return;
						const from = Number(active.id.slice(2));
						const to = Number(over.id.slice(2));
						if (from === to) return;
						const options = [...form.options];
						const [moved] = options.splice(from, 1);
						if (moved) options.splice(to, 0, moved);
						set({ options });
					}}
					overlay={(active) => {
						const option = form.options[Number(active.id.slice(2))];
						return option ? (
							<OptionRow
								drag={{ lifted: true }}
								handle={<DragHandle aria-hidden tabIndex={-1} />}
								value={<Text mono>{option.value}</Text>}
								label={<Text>{option.label}</Text>}
							/>
						) : null;
					}}
				>
					<OptionTable valueLabel={t("settings.field.optionValue")} labelLabel={t("settings.field.optionLabel")}>
						<SortableList id="options" items={form.options.map((_, index) => optionId(index))}>
							{form.options.map((option, index) => (
								<SortableOption
									// biome-ignore lint/suspicious/noArrayIndexKey: a row's value is what is typed in it; its place is its identity.
									key={index}
									id={optionId(index)}
									moveLabel={
										structure ? t("settings.field.moveOption", { value: option.value || option.label }) : undefined
									}
									value={
										structure ? (
											<Input
												appearance="inline"
												mono
												aria-label={t("settings.field.optionValue")}
												value={option.value}
												onChange={(event) =>
													set({
														options: form.options.map((one, at) =>
															at === index ? { ...one, value: event.target.value } : one,
														),
													})
												}
											/>
										) : (
											<Text mono>{option.value}</Text>
										)
									}
									label={
										<Input
											appearance="inline"
											aria-label={t("settings.field.optionLabel")}
											value={option.label}
											onChange={(event) =>
												set({
													options: form.options.map((one, at) =>
														at === index ? { ...one, label: event.target.value } : one,
													),
												})
											}
										/>
									}
									action={
										structure ? (
											<TextButton
												variant="quiet"
												aria-label={t("settings.field.removeOption", { value: option.value })}
												onClick={() => set({ options: form.options.filter((_, at) => at !== index) })}
											>
												×
											</TextButton>
										) : undefined
									}
								/>
							))}
						</SortableList>
					</OptionTable>
				</Sortable>
				{structure ? (
					<Inline gap={0}>
						<TextButton onClick={() => set({ options: [...form.options, { value: "", label: "" }] })}>
							{t("settings.field.addOption")}
						</TextButton>
					</Inline>
				) : null}
			</Stack>
		) : null;

	const required = switchRow(
		// One child, so the spread row keeps the "!" beside its word.
		<span>
			{t("settings.field.required")}{" "}
			<Text tone="faint" mono>
				!
			</Text>
		</span>,
		form.required,
		(required) => set({ required }),
	);

	// The input rules: one row each, its control at the end. Required first, then what this kind has, then the language.
	const rules = (
		<SheetSection title={t("settings.field.rules")}>
			{/* The rows stand at a control's height, so they sit close: the height is their spacing. */}
			<Stack gap={4}>
				{adding ? null : rule(t("settings.field.kindLabel"), <Text tone="subtle">{kindWord(form.kind)}</Text>)}
				{required}
				{form.kind === "text" ? (
					<>
						{switchRow(t("settings.field.multiline"), form.multiline, (multiline) => set({ multiline }))}
						{rule(
							t("settings.field.max"),
							structure ? (
								<Input
									id="field-max"
									mono
									size="md"
									width="number"
									inputMode="numeric"
									align="end"
									placeholder={t("settings.field.noLimit")}
									value={form.max}
									onChange={(event) => set({ max: event.target.value.replace(/\D/g, "") })}
								/>
							) : (
								<Text tone="subtle">
									{form.max ? t("settings.field.maxValue", { max: form.max }) : t("settings.field.noLimit")}
								</Text>
							),
						)}
					</>
				) : null}
				{options}
				{form.kind === "select" ? switchRow(t("settings.field.many"), form.many, (many) => set({ many })) : null}
				{form.kind === "media"
					? pickRow(
							t("settings.field.accept"),
							"field-accept",
							[
								{ value: "image", label: t("settings.field.accept.image") },
								{ value: "any", label: t("settings.field.accept.any") },
							],
							form.accept,
							(accept) => set({ accept: accept as Form["accept"] }),
						)
					: null}
				{form.kind === "relation" ? (
					<>
						{pickRow(t("settings.field.target"), "field-target", targets, form.to, (to) => set({ to }))}
						{switchRow(t("settings.field.manyRelation"), form.many, (many) => set({ many }))}
						{switchRow(t("settings.field.createMissing"), form.createMissing, (createMissing) =>
							set({ createMissing }),
						)}
					</>
				) : null}
				{pickRow(
					t("settings.field.locale"),
					"field-locale",
					LOCALES.map((value) => ({ value, label: t(`settings.field.locale.${value}`) })),
					form.locale,
					(locale) => set({ locale: locale as LocaleMode }),
				)}
			</Stack>
		</SheetSection>
	);

	// The same two parts in every field sheet, on the dev server and on the live site alike: what the field is, then its input rules.
	const sections = (
		<Stack gap={0}>
			{about}
			{rules}
		</Stack>
	);

	const title = adding ? t("settings.field.add") : model.fieldLabel(c, open.key as string);
	const head = (
		<SheetHeader>
			<SheetTitle of={`· ${model.label(c)}`} ofMono={false}>
				{title}
			</SheetTitle>
		</SheetHeader>
	);
	const cancel = (
		<Button variant="ghost" onClick={onClose}>
			{t("settings.cancel")}
		</Button>
	);

	// The same order as the structure the dev server edits: name, kind, required, then what the kind has, then the language.
	if (adding)
		return (
			<SheetContent>
				{head}
				<SheetSplit
					list={
						<PickList aria-label={t("settings.field.kinds")}>
							{KINDS.map((kind) => (
								<PickListItem
									key={kind}
									selected={form.kind === kind}
									mark={kind === "relation" ? "→" : undefined}
									onClick={() => set({ kind })}
								>
									{kindWord(kind)}
								</PickListItem>
							))}
						</PickList>
					}
				>
					<SheetBody>{sections}</SheetBody>
				</SheetSplit>
				<SheetFooter>
					{cancel}
					<Button disabled={!ready} onClick={save}>
						{t("settings.field.addButton")}
					</Button>
				</SheetFooter>
			</SheetContent>
		);

	return (
		<SheetContent>
			{head}
			<SheetBody>{sections}</SheetBody>
			<SheetFooter>
				{structure && !fixedName ? (
					<Inline gap={12} grow minWidth={0}>
						<Button variant="ghost-danger" onClick={remove}>
							{t("settings.field.remove")}
						</Button>
					</Inline>
				) : null}
				{cancel}
				<Button disabled={!ready} onClick={save}>
					{t("settings.save")}
				</Button>
			</SheetFooter>
		</SheetContent>
	);
}
