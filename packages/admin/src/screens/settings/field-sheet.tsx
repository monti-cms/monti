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
	Segmented,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSection,
	SheetSplit,
	SheetSummary,
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
type Kind = (typeof KINDS)[number] | "slug";

/** A field's name: the schema's identifier rule (`checkSchema`), so a wrong one is caught before it is added. */
const IDENTIFIER = /^[a-z][a-zA-Z0-9]*$/;

type Form = {
	kind: Kind;
	name: string;
	label: string;
	description: string;
	placeholder: string;
	rows: string;
	multiline: boolean;
	max: string;
	fillFromBody: boolean;
	required: boolean;
	asTitle: boolean;
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
	placeholder: "",
	rows: "",
	multiline: false,
	max: "",
	fillFromBody: false,
	required: false,
	asTitle: false,
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
		placeholder: String(values.placeholder ?? ""),
		rows: values.rows ? String(values.rows) : "",
		multiline: def.kind === "text" && Boolean(def.multiline),
		max: def.kind === "text" && def.max ? String(def.max) : "",
		fillFromBody: def.kind === "text" && Boolean(def.fillFromBody),
		required: Boolean(def.required),
		asTitle: Boolean(def.asTitle),
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
		asTitle: form.asTitle,
		// "All the same" is what a field without a mode does; a mode it had stays written.
		locale: form.locale === "same" && !was?.locale ? undefined : form.locale,
	};
	if (form.kind === "text")
		return clean({
			kind: "text",
			...common,
			multiline: form.multiline,
			max: form.max ? Number(form.max) : undefined,
			fillFromBody: form.fillFromBody,
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
		placeholder: form.kind === "text" && form.placeholder ? form.placeholder : undefined,
		rows: form.kind === "text" && Number(form.rows) > 0 ? Number(form.rows) : undefined,
		optionLabels: Object.keys(labels).length > 0 ? labels : undefined,
	};
};

/** The one-line summary at the sheet's end: the setting in the schema's words ("series → series"). */
function summaryOf(form: Form) {
	const name = form.name || "…";
	if (form.kind === "relation") return `${name} → ${form.to}${form.many ? " []" : ""}`;
	if (form.kind === "text") return `${name} · text${form.max ? ` · ${form.max}` : ""}`;
	return `${name} · ${form.kind}`;
}

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
 * (label, help, placeholder, rows, option labels) changes. Nothing goes in the draft until the sheet's add or save button.
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

	const switchRow = (label: ReactNode, checked: boolean, onChange: (checked: boolean) => void) => (
		<Option spread>
			{label}
			<Switch checked={checked} onCheckedChange={onChange} disabled={!structure} />
		</Option>
	);
	const kindWord = (kind: Kind) => t(`settings.field.kind.${kind}`);
	const locales = (["same", "perLocale", "fromSource"] as const).map((value) => ({
		value,
		label: t(`settings.field.locale.${value}`),
	}));

	// The name is structure: the add sheet asks it with the label; a saved field's sheet has it under structure, where changing it is a rename.
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
			<ReadValue label={t("settings.field.name")}>{form.name}</ReadValue>
		);

	const view = (
		<>
			<FormField>
				<FormFieldLabel htmlFor="field-label">{t("settings.field.label")}</FormFieldLabel>
				<Input id="field-label" value={form.label} onChange={(event) => set({ label: event.target.value })} />
			</FormField>
			{adding ? nameField : null}
			<FormField>
				<FormFieldLabel htmlFor="field-help">{t("settings.field.help")}</FormFieldLabel>
				<Textarea
					id="field-help"
					tall
					value={form.description}
					onChange={(event) => set({ description: event.target.value })}
				/>
			</FormField>
			{form.kind === "text" ? (
				<>
					<FormField>
						<FormFieldLabel htmlFor="field-placeholder">{t("settings.field.placeholder")}</FormFieldLabel>
						<Input
							id="field-placeholder"
							value={form.placeholder}
							onChange={(event) => set({ placeholder: event.target.value })}
						/>
					</FormField>
					<FormField>
						<FormFieldLabel htmlFor="field-rows">{t("settings.field.rows")}</FormFieldLabel>
						<Input
							id="field-rows"
							mono
							width="number"
							inputMode="numeric"
							value={form.rows}
							onChange={(event) => set({ rows: event.target.value.replace(/\D/g, "") })}
						/>
					</FormField>
				</>
			) : null}
		</>
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

	const settings = structure ? (
		<>
			{form.kind === "text" ? (
				<>
					{switchRow(t("settings.field.multiline"), form.multiline, (multiline) => set({ multiline }))}
					<FormField>
						<FormFieldLabel htmlFor="field-max">{t("settings.field.max")}</FormFieldLabel>
						<Input
							id="field-max"
							mono
							width="number"
							inputMode="numeric"
							value={form.max}
							onChange={(event) => set({ max: event.target.value.replace(/\D/g, "") })}
						/>
					</FormField>
					{switchRow(t("settings.field.fillFromBody"), form.fillFromBody, (fillFromBody) => set({ fillFromBody }))}
				</>
			) : null}
			{options}
			{form.kind === "select" ? switchRow(t("settings.field.many"), form.many, (many) => set({ many })) : null}
			{form.kind === "media" ? (
				<FormField>
					<FormFieldLabel htmlFor="field-accept">{t("settings.field.accept")}</FormFieldLabel>
					<PickOne
						id="field-accept"
						items={[
							{ value: "image", label: t("settings.field.accept.image") },
							{ value: "any", label: t("settings.field.accept.any") },
						]}
						value={form.accept}
						onChange={(accept) => set({ accept: accept as Form["accept"] })}
					/>
				</FormField>
			) : null}
			{form.kind === "relation" ? (
				<>
					<FormField>
						<FormFieldLabel htmlFor="field-target">{t("settings.field.target")}</FormFieldLabel>
						<PickOne id="field-target" items={targets} value={form.to} onChange={(to) => set({ to })} />
					</FormField>
					{switchRow(t("settings.field.manyRelation"), form.many, (many) => set({ many }))}
					{switchRow(t("settings.field.createMissing"), form.createMissing, (createMissing) => set({ createMissing }))}
				</>
			) : null}
			{switchRow(
				// One child, so the spread row keeps the "!" beside its word.
				<span>
					{t("settings.field.required")}{" "}
					<Text tone="faint" mono>
						!
					</Text>
				</span>,
				form.required,
				(required) => set({ required }),
			)}
			{existing ? switchRow(t("settings.field.asTitle"), form.asTitle, (asTitle) => set({ asTitle })) : null}
			<Stack gap={6}>
				<Text variant="micro" tone="subtle">
					{t("settings.field.locale")}
				</Text>
				<Segmented
					aria-label={t("settings.field.locale")}
					value={form.locale}
					onValueChange={(locale) => set({ locale })}
					options={locales}
				/>
			</Stack>
		</>
	) : null;

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
					<SheetBody>
						{view}
						{settings}
						<SheetSummary>{summaryOf(form)}</SheetSummary>
					</SheetBody>
				</SheetSplit>
				<SheetFooter>
					{cancel}
					<Button disabled={!ready} onClick={save}>
						{t("settings.field.addButton")}
					</Button>
				</SheetFooter>
			</SheetContent>
		);

	const lockedFacts = (
		<>
			<ReadValue label={t("settings.field.name")}>{form.name}</ReadValue>
			<ReadValue label={t("settings.field.kindLabel")} mono={false}>
				{kindWord(form.kind)}
				{form.kind === "relation" ? ` → ${model.label(form.to)}` : ""}
			</ReadValue>
			{form.kind === "text" && form.max ? (
				<ReadValue label={t("settings.field.max")} mono={false}>
					{t("settings.field.maxValue", { max: form.max })}
				</ReadValue>
			) : null}
			<ReadValue label={t("settings.field.locale")} mono={false}>
				{t(`settings.field.locale.${form.locale}`)}
			</ReadValue>
			{switchRow(t("settings.field.required"), form.required, () => {})}
			{form.kind === "text" ? switchRow(t("settings.field.multiline"), form.multiline, () => {}) : null}
			{form.kind === "text" ? switchRow(t("settings.field.fillFromBody"), form.fillFromBody, () => {}) : null}
		</>
	);

	return (
		<SheetContent>
			{head}
			<SheetBody>
				<Stack gap={0}>
					<SheetSection title={t("settings.field.view")}>
						{view}
						{locked ? options : null}
					</SheetSection>
					<SheetSection
						title={
							locked ? (
								<Inline gap={6} align="center">
									{t("settings.field.structure")}
									<LockMark label={t("settings.locked")} />
								</Inline>
							) : (
								t("settings.field.structure")
							)
						}
					>
						{locked ? (
							lockedFacts
						) : (
							<>
								{nameField}
								<ReadValue label={t("settings.field.kindLabel")} mono={false}>
									{kindWord(form.kind)}
								</ReadValue>
								{settings}
							</>
						)}
					</SheetSection>
				</Stack>
			</SheetBody>
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
