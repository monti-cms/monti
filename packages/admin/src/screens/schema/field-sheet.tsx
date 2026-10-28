"use client";

import { fieldTraits, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	Inline,
	LockMark,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSection,
	SheetTitle,
	Stack,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { useRef, useState } from "react";
import { useAdminComponents } from "../../admin-components";
import { commonMessages } from "../../lib/common.messages";
import {
	FlagSwitch,
	IssueList,
	orUndefined,
	Pick,
	SegmentedField,
	TextAreaInput,
	TextInput,
	useIssuesUnder,
	useSchemaEdit,
} from "./controls";
import { type CollectionEditing, KindOptions, kindChoices, LOCALIZED_KINDS } from "./field-editor";
import { FieldCustomInputPicker, FieldRolePicker } from "./field-role-input";
import { schemaFieldsMessages } from "./fields.messages";
import { schemaMessages } from "./messages";
import { ReadValue } from "./read-value";
import {
	FIELD_KEY_ORDER,
	type FieldKindName,
	type FieldPlace,
	fieldAt,
	isObj,
	type Obj,
	oppositeOf,
	type Rename,
	removeBlock,
	removeField,
	setField,
	setProp,
	setTitleField,
	titleFieldName,
	withKind,
	withOpposite,
} from "./schema-model";

/**
 * The editor of one field, in a sheet on the right: "View" (what the writer sees: display name, help text, placeholder, rows) then "Structure" (what the saved data
 * depends on: name, kind, required, the kind's own settings, languages). The structure is locked, with the lock after its title, when the file cannot be
 * written. The tab Advanced holds the role and a custom input. Edits go to a copy of the collection: Save puts the copy into the file, Cancel (or closing the
 * sheet) drops it. Deleting a field is the one thing that acts at once, as a change of the file that the review still shows.
 */
export function FieldSheet({
	editing,
	place,
	name,
	onClose,
}: {
	editing: CollectionEditing;
	place: FieldPlace;
	name: string;
	onClose: () => void;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const tc = useTranslator(commonMessages);
	const ts = useTranslator(schemaMessages);
	const { disabled, collectionNames, file } = useSchemaEdit();
	const [draft, setDraft] = useState<Obj>(editing.collection);
	// Renames of options made in the copy are recorded for the review only when the copy is applied.
	const renames = useRef<Rename[]>([]);
	const field = fieldAt(draft, place, name) ?? {};
	const kind = String(field.kind) as FieldKindName;
	const path = place.branch
		? `collections.${editing.collectionName}.fields.${place.branch.field}.values.${place.branch.option}.${name}`
		: `collections.${editing.collectionName}.fields.${name}`;
	const issues = useIssuesUnder(path);

	const draftEditing: CollectionEditing = {
		collectionName: editing.collectionName,
		collection: draft,
		update: (apply) => setDraft((current) => apply(current)),
		onRename: (rename) => {
			renames.current.push(rename);
		},
	};
	const change = (update: (field: Obj) => Obj) => setDraft((current) => setField(current, place, name, update));
	const set = (key: string, value: unknown) => change((current) => setProp(current, key, value, FIELD_KEY_ORDER));
	const setBoth = (key: "label" | "description", value: string | undefined) =>
		change((current) => {
			const next = setProp(current, key, value, FIELD_KEY_ORDER);
			// A conditional field names its select the same way.
			return current.kind === "conditional" && isObj(next.discriminant)
				? { ...next, discriminant: setProp(next.discriminant, key, value, FIELD_KEY_ORDER) }
				: next;
		});
	const valueKind = fieldTraits[kind].entersValue;
	const label = typeof field.label === "string" ? field.label : "";
	const isTitle = !place.branch && titleFieldName(draft) === name;
	const isSlug = !place.branch && (kind === "slug" || name === "slug");
	const isFixed = isTitle || isSlug;
	const { fieldInputs } = useAdminComponents();
	const hasPluginInputs = Object.keys(fieldInputs ?? {}).length > 0;
	const hasCustomInput = typeof field.input === "string" && field.input.length > 0;
	const blocked = removeBlock(editing.collection, place, name);
	// Whether the relation shows on its target too, as the file has it and as the switch is now; the target's backlink changes on Apply.
	const target = typeof field.to === "string" ? field.to : "";
	const savedOpposite =
		!place.branch && kind === "relation" && oppositeOf(file, editing.collectionName, name, target) !== undefined;
	const [opposite, setOpposite] = useState(savedOpposite);
	const collectionTitle =
		typeof editing.collection.label === "string" ? editing.collection.label : editing.collectionName;
	const hasAdvanced = !disabled && valueKind && (!isSlug || hasPluginInputs || hasCustomInput);
	const localized = field.localized === true ? "localized" : field.localized === "inherit" ? "inherit" : "shared";

	const apply = () => {
		editing.update(() => draft);
		const shown = opposite && field.kind === "relation" && field.many === true;
		if (shown !== savedOpposite)
			editing.updateFile?.((current) => withOpposite(current, editing.collectionName, name, target, shown));
		for (const rename of renames.current) editing.onRename(rename);
		onClose();
	};
	const remove = () => {
		editing.update((collection) => removeField(collection, place, name));
		onClose();
	};

	return (
		<Sheet open onOpenChange={(open) => !open && onClose()}>
			<SheetContent data-testid="field-sheet">
				{/* The tabs root is the column that holds the tabs and the scrolling body, so the footer stays in view. */}
				<Tabs defaultValue="basic" render={<Stack gap={0} grow minHeight={0} />}>
					<SheetHeader>
						<SheetTitle of={`· ${collectionTitle}`}>{label || name}</SheetTitle>
					</SheetHeader>
					{hasAdvanced && (
						<TabsList variant="bar" inset="panel">
							<TabsTrigger value="basic">{t("sheet.tabBasic")}</TabsTrigger>
							<TabsTrigger value="advanced">{t("sheet.tabAdvanced")}</TabsTrigger>
						</TabsList>
					)}
					<SheetBody>
						<IssueList issues={issues} />
						<TabsContent value="basic">
							<Stack gap={0}>
								<SheetSection title={t("sheet.view")}>
									<TextInput
										label={t("field.label")}
										required
										value={label}
										onChange={(value) => setBoth("label", value)}
									/>
									<TextAreaInput
										label={t("field.description")}
										value={field.description as string | undefined}
										onChange={(value) => setBoth("description", orUndefined(value))}
									/>
									<KindOptions
										name={name}
										field={field}
										editing={draftEditing}
										set={set}
										change={change}
										place={place}
										part="view"
									/>
								</SheetSection>
								<SheetSection
									title={
										<>
											{t("sheet.structure")}
											{disabled && <LockMark label={ts("lock.cannotChange")} />}
										</>
									}
								>
									<ReadValue label={t("field.name")}>
										{name}
										{!disabled && <LockMark label={ts("lock.cannotChange")} />}
									</ReadValue>
									{disabled ? (
										<ReadValue label={t("field.kind")} mono={false}>
											{t(`kind.${kind}`)}
										</ReadValue>
									) : (
										<Pick
											label={t("field.kind")}
											value={kind}
											disabled={isFixed}
											items={kindChoices(kind).map((item) => ({ value: item, label: t(`kind.${item}`) }))}
											onChange={(next) =>
												change((current) => withKind(current, next as FieldKindName, collectionNames))
											}
										/>
									)}
									{valueKind && kind !== "conditional" && (
										<FlagSwitch
											label={t("field.required")}
											mark="!"
											checked={isTitle || field.required === true}
											locked={isTitle}
											onChange={(on) => set("required", on ? true : undefined)}
										/>
									)}
									{kind === "text" && !place.branch && (
										<FlagSwitch
											label={t("field.isTitle")}
											checked={isTitle}
											locked={isTitle}
											onChange={(on) => on && draftEditing.update((collection) => setTitleField(collection, name))}
										/>
									)}
									<KindOptions
										name={name}
										field={field}
										editing={draftEditing}
										set={set}
										change={change}
										place={place}
										opposite={!place.branch && editing.updateFile ? { on: opposite, onChange: setOpposite } : undefined}
										part="structure"
									/>
									{valueKind &&
										LOCALIZED_KINDS.includes(kind) &&
										(disabled ? (
											<ReadValue label={t("field.localized")} mono={false}>
												{t(
													localized === "localized"
														? "field.localizedOwn"
														: localized === "inherit"
															? "field.localizedInherit"
															: "field.localizedShared",
												)}
											</ReadValue>
										) : (
											<SegmentedField
												label={t("field.localized")}
												value={localized}
												items={[
													{ value: "shared", label: t("field.localizedShared") },
													{ value: "localized", label: t("field.localizedOwn") },
													{ value: "inherit", label: t("field.localizedInherit") },
												]}
												onChange={(value) =>
													set("localized", value === "localized" ? true : value === "inherit" ? "inherit" : undefined)
												}
											/>
										))}
								</SheetSection>
							</Stack>
						</TabsContent>
						<TabsContent value="advanced">
							<Stack gap={16}>
								{!isSlug && valueKind && (
									<FieldRolePicker
										role={field.role as string | undefined}
										kind={kind}
										isTitle={isTitle}
										onChange={(role) => set("role", role)}
									/>
								)}
								{!isFixed && valueKind && (hasPluginInputs || hasCustomInput) && (
									<FieldCustomInputPicker
										value={field.input as string | undefined}
										options={field.inputOptions}
										onChangeInput={(input) => set("input", input)}
										onChangeOptions={(opts) => set("inputOptions", opts)}
									/>
								)}
							</Stack>
						</TabsContent>
					</SheetBody>
				</Tabs>
				<SheetFooter>
					{!disabled && (
						<Inline gap={12} grow minWidth={0}>
							<TextButton variant="danger" disabled={blocked !== null} onClick={remove}>
								{t("sheet.delete")}
							</TextButton>
							{blocked && (
								<Box minWidth={0}>
									<Text variant="caption" tone="muted" data-testid="remove-blocked">
										{t(`field.removeBlocked.${blocked}`)}
									</Text>
								</Box>
							)}
						</Inline>
					)}
					<TextButton onClick={onClose}>{tc("cancel")}</TextButton>
					<Button type="button" disabled={disabled} onClick={apply}>
						{t("sheet.save")}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
