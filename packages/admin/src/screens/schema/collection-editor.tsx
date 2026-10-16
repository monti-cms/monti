"use client";

import { useSite, useTranslator } from "@monti-cms/core/client";
import { Trash2 } from "lucide-react";
import { useId } from "react";
import { editorMessages } from "../../editor/messages";
import type { TranslatorFor } from "../../translator";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Label } from "../../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Section } from "../shared/section";
import { schemaCollectionMessages } from "./collection.messages";
import { FlagSwitch, IssueList, orUndefined, Pick, TextInput, useIssuesUnder, useSchemaEdit } from "./controls";
import { FieldsCard } from "./fields-tree";
import { IconPicker } from "./icon-picker";
import { schemaMessages } from "./messages";
import { PublicPathField } from "./public-path-field";
import {
	type Allowed,
	allowedOf,
	COLLECTION_KEY_ORDER,
	defaultPath,
	fieldsOf,
	hasBody,
	type Obj,
	type Rename,
	setProp,
	withBody,
} from "./schema-model";

const HEADINGS = [1, 2, 3, 4, 5, 6] as const;

type EditorKey = Parameters<TranslatorFor<typeof editorMessages>>[0];

/** The editor dictionary key that names each core block and text style in the allowed-blocks picker. */
const EDITOR_NAME: Partial<Record<string, EditorKey>> = {
	table: "toolbar.table",
	taskList: "toolbar.todo",
	math: "block.math",
	image: "toolbar.image",
	file: "toolbar.file",
	codeBlock: "toolbar.codeBlock",
	blockquote: "toolbar.quote",
	horizontalRule: "toolbar.divider",
	footnotes: "block.footnotes",
	"text-align": "block.text-align",
	bold: "inlineMarks.bold",
	italic: "inlineMarks.italic",
	strike: "inlineMarks.strike",
	underline: "inlineMarks.underline",
	code: "block.code",
	link: "toolbar.link",
	superscript: "inlineMarks.superscript",
	subscript: "inlineMarks.subscript",
};

/** A list the body may be limited to: "Allow all" checkbox allows everything; below are checkboxes per item, always visible. */
function LimitList<T extends string | number>({
	label,
	all,
	value,
	onChange,
	nameOf,
}: {
	label: string;
	all: readonly T[];
	value: readonly T[] | undefined;
	onChange: (value: T[] | undefined) => void;
	nameOf?: (item: T) => string;
}) {
	const t = useTranslator(schemaCollectionMessages);
	const { disabled } = useSchemaEdit();
	const allId = useId();
	const allowedCount = value === undefined ? all.length : all.filter((item) => value.includes(item)).length;
	const allAllowed = allowedCount === all.length;
	const someAllowed = allowedCount > 0 && !allAllowed;
	return (
		<fieldset className="flex flex-col gap-3 border-t pt-6 first:border-t-0 first:pt-0">
			<legend className="sr-only">{label}</legend>
			<div className="flex items-center justify-between">
				<span className="font-medium text-sm">{label}</span>
				<div className="flex items-center gap-2">
					<Checkbox
						id={allId}
						checked={allAllowed}
						indeterminate={someAllowed}
						disabled={disabled}
						onCheckedChange={(on) => onChange(on === true ? undefined : [])}
					/>
					<Label htmlFor={allId} className="cursor-pointer font-normal text-cms-muted-foreground text-sm">
						{t("allowed.all")}
					</Label>
				</div>
			</div>
			<ul className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
				{all.map((item) => {
					const id = `allowed-${label}-${item}`;
					const checked = value === undefined || value.includes(item);
					return (
						<li key={String(item)} className="flex items-center gap-2">
							<Checkbox
								id={id}
								checked={checked}
								disabled={disabled}
								onCheckedChange={(on) => {
									const currentList = value === undefined ? [...all] : value;
									const nextList =
										on === true
											? all.filter((one) => one === item || currentList.includes(one))
											: currentList.filter((one) => one !== item);
									onChange(nextList.length === all.length ? undefined : nextList);
								}}
							/>
							<Label htmlFor={id} title={String(item)} className="font-normal text-sm">
								{nameOf ? nameOf(item) : String(item)}
							</Label>
						</li>
					);
				})}
			</ul>
		</fieldset>
	);
}

/** Which blocks and text styles the body allows: everything unless the writer limits a list. */
function AllowedEditor({
	collection,
	update,
}: {
	collection: Obj;
	update: (change: (collection: Obj) => Obj) => void;
}) {
	const t = useTranslator(schemaCollectionMessages);
	const te = useTranslator(editorMessages);
	const site = useSite();
	const { vocabulary } = useSchemaEdit();
	const allowed = allowedOf(collection);
	// Core blocks and text styles are named by the editor's dictionary; ones a plugin adds use the label of their definition.
	const nameLabel = (id: string): string => {
		const key = EDITOR_NAME[id];
		if (key) return te(key);
		return site.BLOCK_BY_NAME.get(id)?.label ?? id;
	};
	const limited = Object.values(allowed).some((list) => Array.isArray(list));
	const setAllowed = (key: keyof Allowed, value: unknown[] | undefined) =>
		update((current) => {
			const next = { ...allowedOf(current) } as Record<string, unknown>;
			if (value === undefined) delete next[key];
			else next[key] = value;
			return withBody(current, true, next as Allowed);
		});
	return (
		<Section title={t("allowed.title")} note={limited ? t("allowed.note") : undefined}>
			<LimitList
				label={t("allowed.headings")}
				all={HEADINGS}
				value={allowed.headings}
				nameOf={(level) => te("toolbar.heading", { level })}
				onChange={(value) => setAllowed("headings", value)}
			/>
			<LimitList
				label={t("allowed.marks")}
				all={vocabulary.marks}
				nameOf={nameLabel}
				value={allowed.marks}
				onChange={(value) => setAllowed("marks", value)}
			/>
			<LimitList
				label={t("allowed.blocks")}
				all={vocabulary.blocks}
				nameOf={nameLabel}
				value={allowed.blocks}
				onChange={(value) => setAllowed("blocks", value)}
			/>
		</Section>
	);
}

export function CollectionEditor({
	name,
	section,
	onSection,
	collection,
	isNew,
	onChange,
	onRemove,
	onRename,
}: {
	name: string;
	/** The open part of the editor (`basics`, `fields` or `editor`); the screen keeps it in the address. */
	section: string | undefined;
	onSection: (section: string) => void;
	collection: Obj;
	/** Not in the file on disk yet: its name can still be taken back. */
	isNew: boolean;
	onChange: (change: (collection: Obj) => Obj) => void;
	onRemove: () => void;
	onRename: (rename: Rename) => void;
}) {
	const t = useTranslator(schemaCollectionMessages);
	const ts = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	const chosenTab = section ?? "basics";
	const isEditorAvailable = collection.kind !== "item" && hasBody(collection);
	// The editor tab only exists for a document collection with a body.
	const tab = chosenTab === "editor" && !isEditorAvailable ? "basics" : chosenTab;
	const issues = useIssuesUnder(`collections.${name}`, ".fields");
	const _fields = fieldsOf(collection);
	const set = (key: string, value: unknown) =>
		onChange((current) => setProp(current, key, value, COLLECTION_KEY_ORDER));
	const editing = { collectionName: name, collection, update: onChange, onRename };
	const label = typeof collection.label === "string" ? collection.label : name;
	const kindLabel = ts(collection.kind === "item" ? "collection.kindItem" : "collection.kindDocument");
	const path = typeof collection.path === "string" && collection.path !== "" ? collection.path : null;
	return (
		<div className="flex min-w-0 flex-col gap-6" data-testid={`collection-${name}`}>
			<IssueList issues={issues} />
			<Tabs value={tab} onValueChange={(value) => typeof value === "string" && onSection(value)} className="gap-6">
				<div className="flex flex-col items-start gap-3">
					<div className="min-w-0">
						<div className="flex items-baseline gap-2">
							<h3 className="font-semibold text-lg">{label}</h3>
							<code className="text-cms-muted-foreground text-xs">{name}</code>
						</div>
						<p className="mt-1 text-cms-muted-foreground text-sm">
							{path ? t("collection.summary", { kind: kindLabel, path }) : kindLabel}
						</p>
					</div>
					<TabsList className="w-fit justify-start">
						<TabsTrigger value="basics">{t("collection.tabs.basics")}</TabsTrigger>
						<TabsTrigger value="fields">{t("collection.tabs.fields")}</TabsTrigger>
						{isEditorAvailable && <TabsTrigger value="editor">{t("collection.tabs.editor")}</TabsTrigger>}
					</TabsList>
				</div>
				<TabsContent value="basics" className="flex max-w-[1160px] flex-col gap-12">
					<Section title={t("collection.basicsTitle")}>
						<div className="flex flex-col gap-6">
							<TextInput
								label={t("collection.label")}
								value={collection.label as string | undefined}
								onChange={(value) => set("label", value)}
							/>
							<Pick
								label={t("collection.kind")}
								value={String(collection.kind)}
								items={[
									{ value: "document", label: ts("collection.kindDocument") },
									{ value: "item", label: ts("collection.kindItem") },
								]}
								onChange={(value) => {
									onChange((current) => {
										let next = setProp(current, "kind", value, COLLECTION_KEY_ORDER);
										if (value === "item" && hasBody(next)) {
											next = withBody(next, false, {});
										} else if (value === "document" && !hasBody(next)) {
											next = withBody(next, true, {});
										}
										return next;
									});
								}}
							/>
							<IconPicker
								label={t("collection.icon")}
								value={typeof collection.icon === "string" ? collection.icon : undefined}
								kind={typeof collection.kind === "string" ? collection.kind : undefined}
								onChange={(value) => set("icon", value)}
							/>
						</div>
					</Section>
					<Section title={t("collection.featuresTitle")}>
						<div className="flex flex-col gap-6">
							<FlagSwitch
								label={t("collection.folders")}
								checked={typeof collection.folders === "boolean" ? collection.folders : collection.kind !== "item"}
								onChange={(on) => {
									const isDefault = on === (collection.kind !== "item");
									set("folders", isDefault ? undefined : on);
								}}
							/>
							<PublicPathField
								path={typeof collection.path === "string" ? collection.path : ""}
								suggested={defaultPath(name)}
								onChange={(value) => set("path", orUndefined(value))}
							/>
						</div>
					</Section>
					<Section
						title={t("collection.dangerTitle")}
						description={isNew ? undefined : t("collection.dangerDescription")}
						card={false}
					>
						<div className="flex justify-end">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={disabled}
								className="border-cms-destructive/50 text-cms-destructive hover:bg-cms-destructive/10 hover:text-cms-destructive"
								onClick={onRemove}
							>
								<Trash2 aria-hidden />
								{ts("collection.remove")}
							</Button>
						</div>
					</Section>
				</TabsContent>
				<TabsContent value="fields" className="flex flex-col gap-12">
					<FieldsCard editing={editing} />
				</TabsContent>
				{isEditorAvailable && (
					<TabsContent value="editor" className="flex max-w-[1160px] flex-col gap-12">
						<AllowedEditor collection={collection} update={onChange} />
					</TabsContent>
				)}
			</Tabs>
		</div>
	);
}
