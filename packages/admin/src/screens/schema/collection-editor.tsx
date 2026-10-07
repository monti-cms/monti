"use client";

import { useTranslator } from "@monti-cms/core/client";
import { Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Label } from "../../ui/label";
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
import { FieldList } from "./field-editor";
import { schemaMessages } from "./messages";
import {
	type Allowed,
	allowedOf,
	COLLECTION_KEY_ORDER,
	columnsOf,
	FIELD_KINDS,
	fieldsOf,
	hasBody,
	type LayoutGroup,
	layoutOf,
	moveItem,
	type Obj,
	type Rename,
	SYSTEM_COLUMNS,
	setProp,
	storedFieldNames,
	titleFieldName,
	withBody,
	withColumns,
	withLayout,
} from "./schema-model";

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
		<fieldset className="flex flex-col gap-2 rounded-md border p-2.5">
			<legend className="px-1 font-medium text-xs">{label}</legend>
			<FlagSwitch
				label={t("allowed.limit", { label: label.toLowerCase() })}
				hint={limited ? undefined : t("allowed.everything")}
				checked={limited}
				onChange={(on) => onChange(on ? [...all] : undefined)}
			/>
			{limited && (
				<ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
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
	const { vocabulary } = useSchemaEdit();
	const enabled = hasBody(collection);
	const allowed = allowedOf(collection);
	const setAllowed = (key: keyof Allowed, value: unknown[] | undefined) =>
		update((current) => {
			const next = { ...allowedOf(current) } as Record<string, unknown>;
			if (value === undefined) delete next[key];
			else next[key] = value;
			return withBody(current, true, next as Allowed);
		});
	return (
		<section className="flex flex-col gap-3">
			<FlagSwitch
				label={t("collection.body")}
				hint={t("collection.bodyHint")}
				checked={enabled}
				onChange={(on) => update((current) => withBody(current, on, on ? allowedOf(current) : {}))}
			/>
			{enabled && (
				<div className="flex flex-col gap-2">
					<h4 className="font-medium text-sm">{t("allowed.title")}</h4>
					<p className="text-cms-muted-foreground text-xs">{t("allowed.hint")}</p>
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
				</div>
			)}
		</section>
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
		<section className="flex flex-col gap-2">
			<p className="text-cms-muted-foreground text-xs">{t("layout.hint")}</p>
			{groups.map((group, index) => (
				<div key={`${group.group ?? ""}-${index}`} className="flex flex-col gap-2 rounded-lg border p-2.5">
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
			<div>
				<AddButton onClick={() => change([...groups, { fields: [] }])}>{t("layout.add")}</AddButton>
			</div>
		</section>
	);
}

function ListEditor({ collection, update }: { collection: Obj; update: (change: (collection: Obj) => Obj) => void }) {
	const t = useTranslator(schemaMessages);
	const columns = columnsOf(collection);
	const slugs = Object.entries(fieldsOf(collection))
		.filter(([, field]) => field.kind === "slug")
		.map(([name]) => name);
	const options = [...storedFieldNames(collection), ...slugs, ...(slugs.length > 0 ? ["slug"] : []), ...SYSTEM_COLUMNS];
	return (
		<section className="flex flex-col gap-2">
			<FlagSwitch
				label={t("list.custom")}
				hint={columns ? undefined : t("list.default")}
				checked={columns !== undefined}
				onChange={(on) =>
					update((current) =>
						withColumns(current, on ? [titleFieldName(current)].filter((name) => name !== undefined) : undefined),
					)
				}
			/>
			{columns && (
				<OrderedNames
					label={t("list.columns")}
					names={columns}
					options={[...new Set(options)]}
					onChange={(next) => update((current) => withColumns(current, next))}
				/>
			)}
		</section>
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
	return (
		<div className="flex min-w-0 flex-col gap-5" data-testid={`collection-${name}`}>
			<IssueList issues={issues} />
			<section className="flex flex-col gap-3">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h3 className="font-semibold text-base">
							{typeof collection.label === "string" ? collection.label : name}{" "}
							<code className="font-normal text-cms-muted-foreground text-xs">{name}</code>
						</h3>
						<p className="text-cms-muted-foreground text-xs">
							{isNew ? t("collection.newHint") : t("collection.nameHint")}
						</p>
					</div>
					<Button type="button" variant="destructive" size="sm" disabled={disabled} onClick={onRemove}>
						<Trash2 aria-hidden />
						{t("collection.remove")}
					</Button>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
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
			</section>
			<BodyEditor collection={collection} update={onChange} />
			<section className="flex flex-col gap-2">
				<h4 className="font-medium text-sm">{t("field.title")}</h4>
				<FieldList editing={editing} place={{}} fields={fields} kinds={FIELD_KINDS} />
			</section>
			<section className="flex flex-col gap-2">
				<h4 className="font-medium text-sm">{t("layout.title")}</h4>
				<LayoutEditor collection={collection} update={onChange} />
			</section>
			<section className="flex flex-col gap-2">
				<h4 className="font-medium text-sm">{t("list.title")}</h4>
				<ListEditor collection={collection} update={onChange} />
			</section>
		</div>
	);
}
