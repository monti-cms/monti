"use client";

import { fieldTraits, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	Heading,
	Inline,
	PageTabs,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	Stack,
	Tabs,
	TabsContent,
	TabsTrigger,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { useRef, useState } from "react";
import { useAdminComponents } from "../../admin-components";
import { commonMessages } from "../../lib/common.messages";
import { useResizableSheet } from "../../ui/panel-resize";
import { Labeled } from "../shared/labeled";
import {
	FlagSwitch,
	IssueList,
	orUndefined,
	Pick,
	Segmented,
	TextInput,
	useIssuesUnder,
	useSchemaEdit,
} from "./controls";
import { type CollectionEditing, KindOptions, kindChoices, LOCALIZED_KINDS } from "./field-editor";
import { FieldCustomInputPicker, FieldRolePicker } from "./field-role-input";
import { schemaFieldsMessages } from "./fields.messages";
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
 * The editor of one field, in a sheet on the right. Edits go to a copy of the collection: Apply puts the copy into the file, Cancel (or closing the sheet)
 * drops it. Deleting a field is the one thing that acts at once, as a change of the file that the review still shows.
 */
const FIELD_SHEET_RESIZE = { name: "field-sheet", defaultWidth: 520, minWidth: 420 };

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

	const resizable = useResizableSheet(FIELD_SHEET_RESIZE);
	return (
		<Sheet open onOpenChange={(open) => !open && onClose()}>
			<SheetContent resizable={resizable} data-testid="field-sheet" showCloseButton>
				{/* The tabs root is the column that holds the tabs and the scrolling body, so the footer stays in view. */}
				<Tabs defaultValue="basic" render={<Stack gap={0} grow minHeight={0} />}>
					<SheetHeader>
						<SheetTitle>{label || name}</SheetTitle>
						<SheetDescription>
							<Text as="code">{name}</Text> · {t(`kind.${kind}`)}
						</SheetDescription>
					</SheetHeader>
					<PageTabs inset="panel">
						<TabsTrigger value="basic">{t("sheet.tabBasic")}</TabsTrigger>
						<TabsTrigger value="advanced">{t("sheet.tabAdvanced")}</TabsTrigger>
					</PageTabs>
					<Box grow minHeight={0} overflow="y" paddingX={24} paddingY={24}>
						<IssueList issues={issues} />
						<TabsContent value="basic">
							<Stack gap={32}>
								<Stack as="section" gap={24}>
									<TextInput label={t("sheet.label")} value={label} onChange={(value) => setBoth("label", value)} />
									<TextInput
										label={t("field.description")}
										optional
										value={field.description as string | undefined}
										onChange={(value) => setBoth("description", orUndefined(value))}
									/>
									<Labeled label={t("sheet.name")} description={t("sheet.nameHint")}>
										<Inline height="icon" radius="md" background="muted" paddingX={12}>
											<Text as="code">{name}</Text>
										</Inline>
									</Labeled>
								</Stack>
								<Stack as="section" gap={16} border="top" paddingTop={32}>
									<Heading as="h3" variant="label">
										{t("sheet.input")}
									</Heading>
									{kind === "text" && !place.branch && (
										<FlagSwitch
											label={t("field.isTitle")}
											description={isTitle ? t("field.isTitleFixedHint") : t("field.isTitleHint")}
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
									/>
								</Stack>
								{valueKind && (
									<Stack as="section" gap={16} border="top" paddingTop={32}>
										<Heading as="h3" variant="label">
											{t("sheet.rules")}
										</Heading>
										{kind !== "conditional" && (
											<FlagSwitch
												label={t("field.required")}
												description={isTitle ? t("field.requiredTitleHint") : t("field.requiredHint")}
												checked={isTitle || field.required === true}
												locked={isTitle}
												onChange={(on) => set("required", on ? true : undefined)}
											/>
										)}
										{LOCALIZED_KINDS.includes(kind) && (
											<Segmented
												label={t("field.localized")}
												value={
													field.localized === true ? "localized" : field.localized === "inherit" ? "inherit" : "shared"
												}
												items={[
													{ value: "shared", label: t("field.localizedShared") },
													{ value: "localized", label: t("field.localizedOwn") },
													{ value: "inherit", label: t("field.localizedInherit") },
												]}
												onChange={(value) =>
													set("localized", value === "localized" ? true : value === "inherit" ? "inherit" : undefined)
												}
											/>
										)}
									</Stack>
								)}
							</Stack>
						</TabsContent>
						<TabsContent value="advanced">
							<Stack gap={24}>
								<Pick
									label={t("field.kind")}
									description={
										isTitle
											? t("field.kindFixedTitleHint")
											: isSlug
												? t("field.kindFixedSlugHint")
												: t("sheet.kindHint")
									}
									value={kind}
									disabled={isFixed}
									items={kindChoices(kind).map((item) => ({ value: item, label: t(`kind.${item}`) }))}
									onChange={(next) => change((current) => withKind(current, next as FieldKindName, collectionNames))}
								/>
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
					</Box>
				</Tabs>
				<Inline gap={8} border="top" paddingX={24} paddingY={12}>
					<TextButton
						type="button"
						variant="danger"
						disabled={disabled || blocked !== null}
						title={blocked ? t(`field.removeBlocked.${blocked}`) : undefined}
						onClick={remove}
					>
						{t("sheet.delete")}
					</TextButton>
					<Box as="span" grow />
					<Button type="button" variant="secondary" size="sm" onClick={onClose}>
						{tc("cancel")}
					</Button>
					<Button type="button" size="sm" disabled={disabled} onClick={apply}>
						{tc("apply")}
					</Button>
				</Inline>
			</SheetContent>
		</Sheet>
	);
}
