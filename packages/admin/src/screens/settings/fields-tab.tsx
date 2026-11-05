import type { FieldDefinition, SchemaProblem } from "@monti-cms/core";
import {
	Button,
	FieldRow,
	FieldTree,
	FolderTab,
	FolderTabEdit,
	FolderTabs,
	FolderTabsAdd,
	FolderTabsBody,
	FolderTabsList,
	Inline,
	Input,
	Stack,
	Text,
} from "@monti-cms/ui";
import { type DragEvent, Fragment, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { at, type DraftField, type Layout, moveInLayout, shownLayout } from "./schema-draft";
import type { CollectionsDraft } from "./use-collections-draft";

/** The kind at the end of a field's line, as the schema says it: "text · 120", "[] → tag". */
export function kindText(def: FieldDefinition): string {
	if (def.kind === "text") return def.max ? `text · ${def.max}` : "text";
	if (def.kind === "media") return def.accept === "any" ? "media" : "image";
	if (def.kind === "relation") return `${def.many ? "[] " : ""}→ ${def.to}`;
	if (def.kind === "select" && def.many) return "[] select";
	return def.kind;
}

type Target = { before: string } | { group: string; tab: number } | { tab: number };

/**
 * The fields tab of a collection (flow 4, steps 03–09; flow 11, step 17): the property panel's tabs, the fields as one outline with what changed on
 * each line, and the buttons that add a field, a group or a tab. A line opens the field's sheet; its grip moves it in the layout (an admin value, so it
 * moves on the live site too).
 */
export function FieldsTab({
	model,
	collection: c,
	tab,
	onTab,
	onOpenField,
	onAddField,
}: {
	model: CollectionsDraft;
	collection: string;
	tab: number;
	onTab: (tab: number) => void;
	onOpenField: (key: string) => void;
	onAddField: () => void;
}) {
	const { t } = useAdmin();
	const { draft, data } = model;
	const locked = data?.locked ?? true;
	const keys = model.fields(c);
	const layoutPath = at.collectionValue(c, "layout");
	const layout = shownLayout(draft.value(layoutPath) as Layout | undefined, keys, t("settings.fields.defaultTab"));
	const [dragging, setDragging] = useState<string | null>(null);
	const [renaming, setRenaming] = useState<number | null>(null);
	const current = Math.min(tab, layout.length - 1);

	const setLayout = (next: Layout) => draft.set(layoutPath, next);
	const drop = (target: Target) => (event: DragEvent) => {
		if (!dragging) return;
		event.preventDefault();
		event.stopPropagation();
		if ("before" in target && target.before === dragging) return;
		setLayout(moveInLayout(layout, dragging, target));
		setDragging(null);
	};
	const over = (event: DragEvent) => {
		if (dragging) event.preventDefault();
	};

	const problemsOf = (key: string): SchemaProblem[] =>
		model.problems.filter((problem) => problem.collection === c && problem.field === model.fieldName(c, key));

	const row = (key: string, depth: 0 | 1) => {
		const path = at.field(c, key);
		const saved = data?.schema.collections[c]?.fields[key];
		const cell = draft.cell(path);
		const field = model.shown(path) as DraftField | null | undefined;
		const mine = model.changed.some((changed) => changed === path || changed.startsWith(`fa:${c}:${key}:`));
		const problems = problemsOf(key);
		const removed = field === null;
		const shownField = (field ?? (saved ? { name: key, def: saved } : null)) as DraftField | null;
		if (!shownField) return null;
		const { name, def } = shownField;
		const look = removed
			? { tone: "faint" as const, note: t("settings.fields.removed") }
			: problems[0]
				? { tone: "danger" as const, note: t(`settings.problem.short.${problems[0].code}`) }
				: cell.kind === "proposed"
					? { tone: "proposal" as const, note: t("settings.fields.proposed") }
					: !saved
						? { tone: "success" as const, note: t("settings.fields.new") }
						: name !== key
							? { tone: "warning" as const, note: `← ${key}` }
							: { tone: "default" as const, note: key === "title" ? t("settings.fields.notInPanel") : undefined };
		return (
			<FieldRow
				key={key}
				name={def.required ? `${name} !` : name}
				label={(model.shown(at.fieldValue(c, key, "label")) as string | undefined) || undefined}
				description={(model.shown(at.fieldValue(c, key, "description")) as string | undefined) || undefined}
				kind={kindText(def)}
				depth={depth}
				changed={mine && Boolean(saved) && !removed}
				changedLabel={t("settings.changed")}
				onOpen={removed ? undefined : () => onOpenField(key)}
				openLabel={t("settings.fields.open", { name })}
				gripProps={{
					draggable: true,
					"aria-label": t("settings.fields.move", { name }),
					onDragStart: (event) => {
						event.dataTransfer.effectAllowed = "move";
						setDragging(key);
					},
					onDragEnd: () => setDragging(null),
				}}
				dragging={dragging === key}
				onDragOver={over}
				onDrop={drop({ before: key })}
				{...look}
			/>
		);
	};

	const tree = (index: number) => (
		<FieldTree>
			{layout[index]?.fields.map((entry) =>
				typeof entry === "string" ? (
					row(entry, 0)
				) : (
					<Fragment key={`group:${entry.group}`}>
						<FieldRow
							name={entry.group}
							group
							grip={false}
							onDragOver={over}
							onDrop={drop({ group: entry.group, tab: index })}
						/>
						{entry.fields.map((key) => row(key, 1))}
					</Fragment>
				),
			)}
		</FieldTree>
	);

	const addTab = () => {
		setLayout([...layout, { tab: t("settings.fields.newTab"), fields: [] }]);
		onTab(layout.length);
		setRenaming(layout.length);
	};
	const addGroup = () =>
		setLayout(
			layout.map((each, index) =>
				index === current
					? { ...each, fields: [...each.fields, { group: t("settings.fields.newGroup"), fields: [] }] }
					: each,
			),
		);
	const count = (index: number) =>
		layout[index]?.fields.reduce<number>(
			(sum, entry) => sum + (typeof entry === "string" ? 1 : entry.fields.length),
			0,
		) ?? 0;

	return (
		<Stack gap={12} paddingTop={16}>
			{layout.length > 1 ? (
				<FolderTabs value={String(current)} onValueChange={(value) => onTab(Number(value))}>
					<FolderTabsList
						add={
							locked ? undefined : (
								<FolderTabsAdd aria-label={t("settings.fields.addTab")} onClick={addTab}>
									+
								</FolderTabsAdd>
							)
						}
					>
						{layout.map((each, index) =>
							renaming === index ? (
								<FolderTabEdit key={`tab:${each.tab}`}>
									<Input
										appearance="inline"
										width="fit"
										aria-label={t("settings.fields.tabName")}
										defaultValue={each.tab}
										autoFocus
										onBlur={(event) => {
											const name = event.currentTarget.value.trim();
											if (name && name !== each.tab)
												setLayout(layout.map((one, at) => (at === index ? { ...one, tab: name } : one)));
											setRenaming(null);
										}}
										onKeyDown={(event) => {
											if (event.key === "Enter") event.currentTarget.blur();
											if (event.key === "Escape") setRenaming(null);
										}}
									/>
								</FolderTabEdit>
							) : (
								<FolderTab
									key={`tab:${each.tab}`}
									value={String(index)}
									count={String(count(index))}
									draggable={false}
									onDoubleClick={() => setRenaming(index)}
									onDragOver={over}
									onDrop={drop({ tab: index })}
								>
									{each.tab}
								</FolderTab>
							),
						)}
					</FolderTabsList>
					<FolderTabsBody value={String(current)}>{tree(current)}</FolderTabsBody>
				</FolderTabs>
			) : (
				tree(0)
			)}
			<Stack gap={12}>
				<Inline gap={4}>
					{locked ? null : (
						<Button variant="ghost" size="sm" onClick={onAddField}>
							{t("settings.fields.addField")}
						</Button>
					)}
					<Button variant="ghost" size="sm" onClick={addGroup}>
						{t("settings.fields.addGroup")}
					</Button>
					{layout.length === 1 && !locked ? (
						<Button variant="ghost" size="sm" onClick={addTab}>
							{t("settings.fields.addTabText")}
						</Button>
					) : null}
				</Inline>
				<Text as="p" variant="meta" tone="subtle">
					{t("settings.fields.legend")}
				</Text>
			</Stack>
		</Stack>
	);
}
