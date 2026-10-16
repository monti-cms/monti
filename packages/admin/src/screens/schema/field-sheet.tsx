"use client";

import { fieldTraits, useTranslator } from "@monti-cms/core/client";
import { useRef, useState } from "react";
import { useCmsAdminComponents } from "../../admin-components";
import { commonMessages } from "../../lib/common.messages";
import { Button } from "../../ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "../../ui/sheet";
import { LineTabs, Tabs, TabsContent, TabsTrigger } from "../../ui/tabs";
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
import { type CollectionEditing, KindOptions, LOCALIZED_KINDS } from "./field-editor";
import { FieldCustomInputPicker, FieldRolePicker } from "./field-role-input";
import { schemaFieldsMessages } from "./fields.messages";
import {
	FIELD_KEY_ORDER,
	FIELD_KINDS,
	type FieldKindName,
	type FieldPlace,
	fieldAt,
	isObj,
	type Obj,
	type Rename,
	removeBlock,
	removeField,
	setField,
	setProp,
	setTitleField,
	titleFieldName,
	VALUE_KINDS,
	withKind,
} from "./schema-model";

/**
 * The editor of one field, in a sheet on the right. Edits go to a copy of the collection: Apply puts the copy into the file, Cancel (or closing the sheet)
 * drops it. Deleting a field is the one thing that acts at once, as a change of the file that the review still shows.
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
	const { disabled, collectionNames } = useSchemaEdit();
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
	const { fieldInputs } = useCmsAdminComponents();
	const hasPluginInputs = Object.keys(fieldInputs ?? {}).length > 0;
	const hasCustomInput = typeof field.input === "string" && field.input.length > 0;
	const blocked = removeBlock(editing.collection, place, name);
	const branchKinds = place.branch ? VALUE_KINDS : FIELD_KINDS;

	const apply = () => {
		editing.update(() => draft);
		for (const rename of renames.current) editing.onRename(rename);
		onClose();
	};
	const remove = () => {
		editing.update((collection) => removeField(collection, place, name));
		onClose();
	};

	return (
		<Sheet open onOpenChange={(open) => !open && onClose()}>
			<SheetContent
				resize={{ name: "field-sheet", defaultWidth: 520, minWidth: 420 }}
				className="gap-0"
				data-testid="field-sheet"
				showCloseButton
			>
				<Tabs defaultValue="basic" className="min-h-0 flex-1 gap-0">
					<SheetHeader className="gap-0 px-6 pt-5 pb-0">
						<SheetTitle className="pr-10 font-semibold text-base">{label || name}</SheetTitle>
						<SheetDescription className="text-xs">
							<code>{name}</code> · {t(`kind.${kind}`)}
						</SheetDescription>
						<LineTabs className="mt-4 h-auto gap-5 rounded-none p-0">
							<TabsTrigger value="basic" className="h-9 flex-none px-0">
								{t("sheet.tabBasic")}
							</TabsTrigger>
							<TabsTrigger value="advanced" className="h-9 flex-none px-0">
								{t("sheet.tabAdvanced")}
							</TabsTrigger>
						</LineTabs>
					</SheetHeader>
					<div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
						<IssueList issues={issues} />
						<TabsContent value="basic" className="flex flex-col gap-8">
							<section className="flex flex-col gap-6">
								<TextInput label={t("sheet.label")} value={label} onChange={(value) => setBoth("label", value)} />
								<TextInput
									label={t("field.description")}
									optional
									value={field.description as string | undefined}
									onChange={(value) => setBoth("description", orUndefined(value))}
								/>
								<Labeled label={t("sheet.name")} description={t("sheet.nameHint")}>
									<div className="flex h-9 items-center rounded-md bg-cms-muted px-3 text-sm">
										<code>{name}</code>
									</div>
								</Labeled>
							</section>
							<section className="flex flex-col gap-5 border-t pt-8">
								<h3 className="font-semibold text-sm">{t("sheet.input")}</h3>
								{kind === "text" && !place.branch && (
									<FlagSwitch
										label={t("field.isTitle")}
										description={t("field.isTitleHint")}
										checked={isTitle}
										onChange={(on) => on && draftEditing.update((collection) => setTitleField(collection, name))}
									/>
								)}
								<KindOptions name={name} field={field} editing={draftEditing} set={set} change={change} />
							</section>
							{valueKind && (
								<section className="flex flex-col gap-5 border-t pt-8">
									<h3 className="font-semibold text-sm">{t("sheet.rules")}</h3>
									{kind !== "conditional" && (
										<FlagSwitch
											label={t("field.required")}
											description={t("field.requiredHint")}
											checked={field.required === true}
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
								</section>
							)}
						</TabsContent>
						<TabsContent value="advanced" className="flex flex-col gap-6">
							<Pick
								label={t("field.kind")}
								description={
									isTitle ? t("field.kindFixedTitleHint") : isSlug ? t("field.kindFixedSlugHint") : t("sheet.kindHint")
								}
								value={kind}
								disabled={isFixed}
								items={branchKinds.map((item) => ({ value: item, label: t(`kind.${item}`) }))}
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
						</TabsContent>
					</div>
				</Tabs>
				<SheetFooter className="mt-0 flex-row items-center gap-2 border-t px-6 py-3.5">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={disabled || blocked !== null}
						title={blocked ? t(`field.removeBlocked.${blocked}`) : undefined}
						className="-ml-2.5 text-cms-destructive hover:text-cms-destructive"
						onClick={remove}
					>
						{t("sheet.delete")}
					</Button>
					<div className="flex-1" />
					<Button type="button" variant="outline" size="sm" onClick={onClose}>
						{tc("cancel")}
					</Button>
					<Button type="button" size="sm" disabled={disabled} onClick={apply}>
						{tc("apply")}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
