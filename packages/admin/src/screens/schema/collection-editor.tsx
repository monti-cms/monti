"use client";

import { useTranslator } from "@monti-cms/core/client";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Label } from "../../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { COLLECTION_ICON_NAMES } from "../shared/collection-icon";
import {
	AddButton,
	FlagSwitch,
	IssueList,
	OrderedNames,
	orUndefined,
	Pick,
	RowActions,
	TextInput,
	useIssuesUnder,
	useSchemaEdit,
} from "./controls";
import { FieldsCard } from "./fields-tree";
import { schemaMessages } from "./messages";
import {
	type Allowed,
	allowedOf,
	COLLECTION_KEY_ORDER,
	FIELD_KINDS,
	fieldsOf,
	hasBody,
	type LayoutGroup,
	layoutOf,
	moveItem,
	type Obj,
	type Rename,
	setProp,
	storedFieldNames,
	titleFieldName,
	withBody,
	withLayout,
} from "./schema-model";
import { Section } from "./section";

const HEADINGS = [1, 2, 3, 4, 5, 6] as const;

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
	const t = useTranslator(schemaMessages);
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
								<Label htmlFor={id} className="font-normal text-sm">
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
	const t = useTranslator(schemaMessages);
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
	const t = useTranslator(schemaMessages);
	const { vocabulary } = useSchemaEdit();
	const allowed = allowedOf(collection);
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
				value={allowed.blocks}
				onChange={(value) => setAllowed("blocks", value)}
			/>
			<LimitList
				label={t("allowed.marks")}
				all={vocabulary.marks}
				value={allowed.marks}
				onChange={(value) => setAllowed("marks", value)}
			/>
			<LimitList
				label={t("allowed.headings")}
				all={HEADINGS}
				value={allowed.headings}
				nameOf={(level) => `H${level}`}
				onChange={(value) => setAllowed("headings", value)}
			/>
		</Section>
	);
}

function LayoutEditor({ collection, update }: { collection: Obj; update: (change: (collection: Obj) => Obj) => void }) {
	const t = useTranslator(schemaMessages);
	const groups = layoutOf(collection);
	const names = storedFieldNames(collection).concat(
		Object.entries(fieldsOf(collection))
			.filter(([, field]) => field.kind === "view" || field.kind === "backlink")
			.map(([name]) => name),
	);
	const change = (next: LayoutGroup[]) => update((current) => withLayout(current, next));
	const edit = (index: number, patch: Partial<LayoutGroup>) =>
		change(
			groups.map((group, at) => {
				if (at !== index) return group;
				const merged: Record<string, unknown> = { ...group, ...patch };
				for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
				return merged as unknown as LayoutGroup;
			}),
		);
	return (
		<Section title={t("layout.title")} description={t("layout.description")} note={t("layout.hint")}>
			<div className="flex flex-col divide-y">
				{groups.map((group, index) => (
					<div key={`${group.group ?? ""}-${index}`} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0">
						<div className="flex items-end gap-2">
							<TextInput
								label={t("layout.group")}
								value={group.group}
								className="min-w-0 flex-1"
								onChange={(value) => edit(index, { group: orUndefined(value) })}
							/>
							<TextInput
								label={t("layout.tab")}
								value={group.tab}
								className="w-32"
								onChange={(value) => edit(index, { tab: orUndefined(value) })}
							/>
							<RowActions
								index={index}
								count={groups.length}
								name={group.group ?? t("layout.untitled")}
								onMove={(delta) => change(moveItem(groups, index, delta))}
								onRemove={() => change(groups.filter((_, at) => at !== index))}
							/>
						</div>
						<FlagSwitch
							label={t("layout.collapsed")}
							checked={group.collapsed === true}
							onChange={(on) => edit(index, { collapsed: on ? true : undefined })}
						/>
						<OrderedNames
							label={t("layout.fields")}
							names={group.fields}
							options={names}
							onChange={(next) => edit(index, { fields: next })}
						/>
					</div>
				))}
			</div>
			<div>
				<AddButton onClick={() => change([...groups, { fields: [] }])}>{t("layout.add")}</AddButton>
			</div>
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
	const t = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	const [tab, setTab] = useState("basics");
	const issues = useIssuesUnder(`collections.${name}`, ".fields");
	const fields = fieldsOf(collection);
	const set = (key: string, value: unknown) =>
		onChange((current) => setProp(current, key, value, COLLECTION_KEY_ORDER));
	const icon = typeof collection.icon === "string" ? collection.icon : "";
	const icons = [...new Set(["", ...COLLECTION_ICON_NAMES, ...(icon ? [icon] : [])])].map((value) => ({
		value,
		label: value || t("collection.iconDefault"),
	}));
	const editing = { collectionName: name, collection, update: onChange, onRename };
	const label = typeof collection.label === "string" ? collection.label : name;
	const kindLabel = t(collection.kind === "item" ? "collection.kindItem" : "collection.kindDocument");
	const path = typeof collection.path === "string" && collection.path !== "" ? collection.path : null;
	return (
		<div className="flex min-w-0 flex-col gap-6" data-testid={`collection-${name}`}>
			<IssueList issues={issues} />
			<Tabs value={tab} onValueChange={(value) => typeof value === "string" && setTab(value)} className="gap-6">
				<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
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
					<TabsList className="w-full justify-start sm:w-fit">
						<TabsTrigger value="basics">{t("collection.tabs.basics")}</TabsTrigger>
						<TabsTrigger value="fields">{t("collection.tabs.fields")}</TabsTrigger>
						<TabsTrigger value="advanced">{t("collection.tabs.advanced")}</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="basics" className="flex flex-col gap-12">
					<Section
						title={t("collection.basicsTitle")}
						description={t("collection.basicsDescription")}
						note={isNew ? undefined : t("collection.nameHint")}
					>
						<div className="flex max-w-md flex-col gap-6">
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
									{ value: "document", label: t("collection.kindDocument") },
									{ value: "item", label: t("collection.kindItem") },
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
				</TabsContent>
				<TabsContent value="fields" className="flex flex-col gap-12">
					<FieldsCard editing={editing} />
					<LayoutEditor collection={collection} update={onChange} />
				</TabsContent>
				<TabsContent value="advanced" className="flex flex-col gap-12">
					{hasBody(collection) ? (
						<AllowedEditor collection={collection} update={onChange} />
					) : (
						<p className="text-cms-muted-foreground text-sm">{t("advanced.noBody")}</p>
					)}
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
								{t("collection.remove")}
							</Button>
						</div>
					</Section>
				</TabsContent>
			</Tabs>
		</div>
	);
}
