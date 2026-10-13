"use client";

import { useSite, useTranslator } from "@monti-cms/core/client";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { editorMessages } from "../../editor/messages";
import type { TranslatorFor } from "../../translator";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Label } from "../../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { COLLECTION_ICON_NAMES } from "../shared/collection-icon";
import { Section } from "../shared/section";
import { schemaCollectionMessages } from "./collection.messages";
import { FlagSwitch, IssueList, orUndefined, Pick, TextInput, useIssuesUnder, useSchemaEdit } from "./controls";
import { FieldsCard } from "./fields-tree";
import { schemaMessages } from "./messages";
import {
	type Allowed,
	allowedOf,
	COLLECTION_KEY_ORDER,
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

/** A list the body may be limited to: off allows everything of its kind; on shows a box per name. */
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
	const limited = value !== undefined;
	return (
		<fieldset className="flex flex-col gap-3 border-t pt-6 first:border-t-0 first:pt-0">
			<legend className="sr-only">{label}</legend>
			<FlagSwitch
				label={t("allowed.limit", { label: label.toLowerCase() })}
				hint={limited ? undefined : t("allowed.everything")}
				checked={limited}
				onChange={(on) => onChange(on ? [...all] : undefined)}
			/>
			{limited && (
				<ul className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
					{all.map((item) => {
						const id = `allowed-${label}-${item}`;
						return (
							<li key={String(item)} className="flex items-center gap-2">
								<Checkbox
									id={id}
									checked={value.includes(item)}
									disabled={disabled}
									onCheckedChange={(on) =>
										onChange(
											on === true
												? all.filter((one) => one === item || value.includes(one))
												: value.filter((one) => one !== item),
										)
									}
								/>
								<Label htmlFor={id} title={String(item)} className="font-normal text-sm">
									{nameOf ? nameOf(item) : String(item)}
								</Label>
							</li>
						);
					})}
				</ul>
			)}
		</fieldset>
	);
}

function BodyEditor({ collection, update }: { collection: Obj; update: (change: (collection: Obj) => Obj) => void }) {
	const t = useTranslator(schemaCollectionMessages);
	return (
		<Section title={t("collection.bodyTitle")} description={t("collection.bodyDescription")}>
			<FlagSwitch
				label={t("collection.body")}
				hint={t("collection.bodyHint")}
				checked={hasBody(collection)}
				onChange={(on) => update((current) => withBody(current, on, on ? allowedOf(current) : {}))}
			/>
		</Section>
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
		<Section title={t("allowed.title")} description={t("allowed.hint")} note={limited ? t("allowed.note") : undefined}>
			<LimitList
				label={t("allowed.blocks")}
				all={vocabulary.blocks}
				nameOf={nameLabel}
				value={allowed.blocks}
				onChange={(value) => setAllowed("blocks", value)}
			/>
			<LimitList
				label={t("allowed.marks")}
				all={vocabulary.marks}
				nameOf={nameLabel}
				value={allowed.marks}
				onChange={(value) => setAllowed("marks", value)}
			/>
			<LimitList
				label={t("allowed.headings")}
				all={HEADINGS}
				value={allowed.headings}
				nameOf={(level) => te("toolbar.heading", { level })}
				onChange={(value) => setAllowed("headings", value)}
			/>
		</Section>
	);
}

export function CollectionEditor({
	name,
	collection,
	isNew,
	onChange,
	onRemove,
	onRename,
}: {
	name: string;
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
	const [chosenTab, setTab] = useState("basics");
	// The editor tab only exists for a collection with a body.
	const tab = chosenTab === "editor" && !hasBody(collection) ? "basics" : chosenTab;
	const issues = useIssuesUnder(`collections.${name}`, ".fields");
	const _fields = fieldsOf(collection);
	const set = (key: string, value: unknown) =>
		onChange((current) => setProp(current, key, value, COLLECTION_KEY_ORDER));
	const icon = typeof collection.icon === "string" ? collection.icon : "";
	const icons = [...new Set(["", ...COLLECTION_ICON_NAMES, ...(icon ? [icon] : [])])].map((value) => ({
		value,
		label: value || t("collection.iconDefault"),
	}));
	const editing = { collectionName: name, collection, update: onChange, onRename };
	const label = typeof collection.label === "string" ? collection.label : name;
	const kindLabel = ts(collection.kind === "item" ? "collection.kindItem" : "collection.kindDocument");
	const path = typeof collection.path === "string" && collection.path !== "" ? collection.path : null;
	return (
		<div className="flex min-w-0 flex-col gap-6" data-testid={`collection-${name}`}>
			<IssueList issues={issues} />
			<Tabs value={tab} onValueChange={(value) => typeof value === "string" && setTab(value)} className="gap-6">
				<div className="flex flex-col items-start gap-3">
					<div className="min-w-0">
						<div className="flex items-baseline gap-2">
							<h3 className="font-semibold text-lg">{label}</h3>
							<code className="text-cms-muted-foreground text-xs">{name}</code>
						</div>
						<p className="mt-1 text-cms-muted-foreground text-sm">
							{path
								? t("collection.summary", { kind: kindLabel, path })
								: t("collection.summaryNoPath", { kind: kindLabel })}
						</p>
						{isNew && <p className="mt-0.5 text-cms-muted-foreground text-xs">{t("collection.newHint")}</p>}
					</div>
					<TabsList className="w-fit justify-start">
						<TabsTrigger value="basics">{t("collection.tabs.basics")}</TabsTrigger>
						<TabsTrigger value="fields">{t("collection.tabs.fields")}</TabsTrigger>
						{hasBody(collection) && <TabsTrigger value="editor">{t("collection.tabs.editor")}</TabsTrigger>}
					</TabsList>
				</div>
				<TabsContent value="basics" className="flex max-w-[1160px] flex-col gap-12">
					<Section
						title={t("collection.basicsTitle")}
						description={t("collection.basicsDescription")}
						note={isNew ? undefined : t("collection.nameHint")}
					>
						<div className="flex flex-col gap-6">
							<TextInput
								label={t("collection.label")}
								value={collection.label as string | undefined}
								onChange={(value) => set("label", value)}
							/>
							<Pick
								label={t("collection.kind")}
								hint={collection.kind === "item" ? t("collection.kindItemHint") : t("collection.kindDocumentHint")}
								value={String(collection.kind)}
								items={[
									{ value: "document", label: ts("collection.kindDocument") },
									{ value: "item", label: ts("collection.kindItem") },
								]}
								onChange={(value) => set("kind", value)}
							/>
							<Pick
								label={t("collection.icon")}
								value={icon}
								items={icons}
								onChange={(value) => set("icon", orUndefined(value))}
							/>
							<TextInput
								label={t("collection.path")}
								hint={t("collection.pathHint")}
								placeholder="/posts/:slug"
								value={collection.path as string | undefined}
								onChange={(value) => set("path", orUndefined(value))}
							/>
						</div>
					</Section>
					<BodyEditor collection={collection} update={onChange} />
					<Section
						title={t("collection.dangerTitle")}
						description={isNew ? t("collection.newHint") : t("collection.dangerDescription")}
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
				{hasBody(collection) && (
					<TabsContent value="editor" className="flex max-w-[1160px] flex-col gap-12">
						<AllowedEditor collection={collection} update={onChange} />
					</TabsContent>
				)}
			</Tabs>
		</div>
	);
}
