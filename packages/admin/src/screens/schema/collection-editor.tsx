"use client";

import { type CollectionKind, kindDefaults, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	Checkbox,
	DangerBlock,
	DangerRow,
	Grid,
	Heading,
	Inline,
	Label,
	Section,
	Stack,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Text,
} from "@monti-cms/ui";
import { useId } from "react";
import { editorMessages } from "../../editor/messages";
import type { TranslatorFor } from "../../translator";
import { schemaCollectionMessages } from "./collection.messages";
import {
	FlagSwitch,
	IssueList,
	orUndefined,
	Pick,
	RevertMark,
	TextInput,
	useIssuesUnder,
	useSchemaEdit,
} from "./controls";
import { FieldsCard } from "./fields-tree";
import { IconPicker } from "./icon-picker";
import { schemaMessages } from "./messages";
import { PublicPathField } from "./public-path-field";
import {
	type Allowed,
	allowedOf,
	COLLECTION_KEY_ORDER,
	type CollectionChange,
	collectionsOf,
	defaultPath,
	fieldsOf,
	hasBody,
	localesOf,
	type Obj,
	type Rename,
	sameJson,
	setProp,
	withBody,
	withPublicPath,
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
	revert,
	divided,
}: {
	label: string;
	/** A hairline above the list, when it follows another one. */
	divided?: boolean;
	/** Puts the saved list back; given only while the list differs from the saved file. */
	revert?: () => void;
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
		<Stack
			role="group"
			aria-label={label}
			gap={12}
			border={divided ? "top" : undefined}
			paddingTop={divided ? 24 : undefined}
		>
			<Inline justify="between">
				<Inline as="span" gap={8}>
					<Text weight="medium">{label}</Text>
					{revert && <RevertMark name={label} onRevert={revert} />}
				</Inline>
				<Inline gap={8}>
					<Checkbox
						id={allId}
						checked={allAllowed}
						indeterminate={someAllowed}
						disabled={disabled}
						onCheckedChange={(on) => onChange(on === true ? undefined : [])}
					/>
					<Label htmlFor={allId} size="body" tone="muted">
						{t("allowed.all")}
					</Label>
				</Inline>
			</Inline>
			<Grid as="ul" columns={3} gap={8}>
				{all.map((item) => {
					const id = `allowed-${label}-${item}`;
					const checked = value === undefined || value.includes(item);
					return (
						<Inline as="li" key={String(item)} gap={8}>
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
							<Label htmlFor={id} size="body" title={String(item)}>
								{nameOf ? nameOf(item) : String(item)}
							</Label>
						</Inline>
					);
				})}
			</Grid>
		</Stack>
	);
}

/** Which blocks and text styles the body allows: everything unless the writer limits a list. */
function AllowedEditor({
	collection,
	saved: savedCollection,
	update,
}: {
	collection: Obj;
	/** The collection as saved; none for a new one, whose lists cannot be reverted. */
	saved: Obj | undefined;
	update: (change: (collection: Obj) => Obj) => void;
}) {
	const t = useTranslator(schemaCollectionMessages);
	const te = useTranslator(editorMessages);
	const site = useSite();
	const { vocabulary } = useSchemaEdit();
	const allowed = allowedOf(collection);
	const savedAllowed = savedCollection ? allowedOf(savedCollection) : undefined;
	const revertOf = (key: keyof Allowed) =>
		savedAllowed && !sameJson(savedAllowed[key], allowed[key]) ? () => setAllowed(key, savedAllowed[key]) : undefined;
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
		<Section title={t("allowed.title")}>
			<LimitList
				label={t("allowed.headings")}
				all={HEADINGS}
				value={allowed.headings}
				revert={revertOf("headings")}
				nameOf={(level) => te("toolbar.heading", { level })}
				onChange={(value) => setAllowed("headings", value)}
			/>
			<LimitList
				label={t("allowed.marks")}
				all={vocabulary.marks}
				divided
				nameOf={nameLabel}
				value={allowed.marks}
				revert={revertOf("marks")}
				onChange={(value) => setAllowed("marks", value)}
			/>
			<LimitList
				label={t("allowed.blocks")}
				all={vocabulary.blocks}
				divided
				nameOf={nameLabel}
				value={allowed.blocks}
				revert={revertOf("blocks")}
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
	onChange,
	footprint,
	onRemove,
	onRename,
	onFileChange,
	changes,
}: {
	name: string;
	/** Which of its tabs hold a change against the saved file. */
	changes?: CollectionChange;
	/** The open part of the editor (`basics`, `fields` or `editor`); the screen keeps it in the address. */
	section: string | undefined;
	onSection: (section: string) => void;
	collection: Obj;
	/** Not in the file on disk yet: its name can still be taken back. */
	onChange: (change: (collection: Obj) => Obj) => void;
	/** What the collection holds in the store; none when that is not known. */
	footprint?: { entries: number; trashed: number; folders: number };
	/** Takes the collection out of the list (nothing is deleted before the draft is saved). */
	onRemove: () => void;
	onRename: (rename: Rename) => void;
	/** Changes the whole file, for an edit that reaches another collection. */
	onFileChange: (change: (file: Obj) => Obj) => void;
}) {
	const t = useTranslator(schemaCollectionMessages);
	const ts = useTranslator(schemaMessages);
	const { disabled, file, saved } = useSchemaEdit();
	const savedCollection = collectionsOf(saved)[name];
	const chosenTab = section ?? "basics";
	const isEditorAvailable = kindDefaults(collection.kind as CollectionKind | undefined).body && hasBody(collection);
	// The editor tab only exists for a document collection with a body.
	const tab = chosenTab === "editor" && !isEditorAvailable ? "basics" : chosenTab;
	const issues = useIssuesUnder(`collections.${name}`, ".fields");
	const _fields = fieldsOf(collection);
	const set = (key: string, value: unknown) =>
		onChange((current) => setProp(current, key, value, COLLECTION_KEY_ORDER));
	// A saved collection's setting that differs from the file: the function that puts the saved value back (a collection that is not saved has none).
	const revert = (key: string) =>
		savedCollection && !sameJson(savedCollection[key], collection[key])
			? () => set(key, savedCollection[key])
			: undefined;
	const changeKind = (value: string) =>
		onChange((current) => {
			let next = setProp(current, "kind", value, COLLECTION_KEY_ORDER);
			if (value === "item" && hasBody(next)) {
				next = withBody(next, false, {});
			} else if (value === "document" && !hasBody(next)) {
				next = withBody(next, true, {});
			}
			return next;
		});
	const editing = { collectionName: name, collection, update: onChange, onRename, updateFile: onFileChange };
	const label = typeof collection.label === "string" ? collection.label : name;
	const kindLabel = ts(collection.kind === "item" ? "collection.kindItem" : "collection.kindDocument");
	const path = typeof collection.path === "string" && collection.path !== "" ? collection.path : null;
	return (
		<Stack gap={24} minWidth={0} data-testid={`collection-${name}`}>
			<IssueList issues={issues} />
			<Tabs value={tab} onValueChange={(value) => typeof value === "string" && onSection(value)}>
				<Inline align="end" justify="between" gap={16} border="bottom-contrast" paddingBottom={12}>
					<Box minWidth={0}>
						<Inline align="baseline" gap={8}>
							<Heading as="h3">{label}</Heading>
							<Text as="code" variant="caption" tone="muted">
								{name}
							</Text>
						</Inline>
						<Text as="p" variant="label" tone="muted">
							{path ? t("collection.summary", { kind: kindLabel, path }) : kindLabel}
						</Text>
					</Box>
					<TabsList variant="line">
						<TabsTrigger value="basics" dot={changes?.basics ? "warning" : undefined} dotLabel={ts("changed")}>
							{t("collection.tabs.basics")}
						</TabsTrigger>
						<TabsTrigger value="fields" dot={changes?.fields ? "warning" : undefined} dotLabel={ts("changed")}>
							{t("collection.tabs.fields")}
						</TabsTrigger>
						{isEditorAvailable && (
							<TabsTrigger value="editor" dot={changes?.editor ? "warning" : undefined} dotLabel={ts("changed")}>
								{t("collection.tabs.editor")}
							</TabsTrigger>
						)}
					</TabsList>
				</Inline>
				<TabsContent value="basics">
					<Stack gap={48} maxWidth="content">
						<Section title={t("collection.basicsTitle")}>
							<TextInput
								label={t("collection.label")}
								revert={revert("label")}
								value={collection.label as string | undefined}
								onChange={(value) => set("label", value)}
							/>
							<Pick
								label={t("collection.kind")}
								revert={
									savedCollection && savedCollection.kind !== collection.kind
										? () => changeKind(String(savedCollection.kind))
										: undefined
								}
								value={String(collection.kind)}
								items={[
									{ value: "document", label: ts("collection.kindDocument") },
									{ value: "item", label: ts("collection.kindItem") },
								]}
								onChange={changeKind}
							/>
							<IconPicker
								label={t("collection.icon")}
								revert={revert("icon")}
								value={typeof collection.icon === "string" ? collection.icon : undefined}
								kind={typeof collection.kind === "string" ? collection.kind : undefined}
								onChange={(value) => set("icon", value)}
							/>
						</Section>
						<Section title={t("collection.featuresTitle")}>
							<FlagSwitch
								label={t("collection.folders")}
								revert={revert("folders")}
								checked={
									typeof collection.folders === "boolean"
										? collection.folders
										: kindDefaults(collection.kind as CollectionKind | undefined).folders
								}
								onChange={(on) => {
									const isDefault = on === kindDefaults(collection.kind as CollectionKind | undefined).folders;
									set("folders", isDefault ? undefined : on);
								}}
							/>
							<PublicPathField
								revert={
									savedCollection && !sameJson(savedCollection.path, collection.path)
										? () =>
												onChange((current) =>
													withPublicPath(
														current,
														typeof savedCollection.path === "string" ? orUndefined(savedCollection.path) : undefined,
														localesOf(file).length > 1,
													),
												)
										: undefined
								}
								path={typeof collection.path === "string" ? collection.path : ""}
								suggested={defaultPath(name)}
								onChange={(value) =>
									onChange((current) => withPublicPath(current, orUndefined(value), localesOf(file).length > 1))
								}
							/>
						</Section>
						{!disabled && (
							<DangerBlock title={t("collection.dangerTitle")} data-testid="collection-delete">
								<DangerRow
									name={label}
									meta={footprint ? t("collection.count", { ...footprint, kind: String(collection.kind) }) : undefined}
									action={
										<Button type="button" variant="outline-danger" size="sm" onClick={onRemove}>
											{t("collection.delete")}
										</Button>
									}
								/>
							</DangerBlock>
						)}
					</Stack>
				</TabsContent>
				<TabsContent value="fields">
					<FieldsCard editing={editing} />
				</TabsContent>
				{isEditorAvailable && (
					<TabsContent value="editor">
						<Box maxWidth="content">
							<AllowedEditor collection={collection} saved={savedCollection} update={onChange} />
						</Box>
					</TabsContent>
				)}
			</Tabs>
		</Stack>
	);
}
