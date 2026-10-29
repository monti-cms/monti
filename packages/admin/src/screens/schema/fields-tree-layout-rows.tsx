"use client";

// The rows of the tab / group layout of the fields tree: a tab row, a group row (both with in-place names) and the drop rows between them.

import { ArrowRight, CollapseAll, TrashCan } from "@carbon/icons-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { FieldRow, Input, Text } from "@monti-cms/ui";
import { useEffect, useRef, useState } from "react";
import { tabLabel } from "../entries/layout-groups";
import { schemaFieldsMessages } from "./fields.messages";
import { groupId } from "./fields-tree-dnd";
import { type Destination, MoveDialog, type RowButton, RowButtons } from "./fields-tree-rows";
import { editGroup, moveGroupToTab, removeGroup, type Tree } from "./layout-model";

/** An input that edits a name in place: it changes the tree on Enter or when it loses focus, and Escape gives the old name back. */
export function InlineName({
	value,
	label,
	disabled,
	inputRef,
	onCommit,
	maxLength,
}: {
	value: string;
	label: string;
	disabled: boolean;
	inputRef?: React.RefObject<HTMLInputElement | null>;
	onCommit: (value: string) => void;
	maxLength?: number;
}) {
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);
	const commit = () => {
		if (draft.trim() === "" || draft.trim() === value) setDraft(value);
		else onCommit(draft.trim());
	};
	return (
		<Input
			ref={inputRef}
			appearance="inline"
			size="sm"
			value={draft}
			aria-label={label}
			disabled={disabled}
			maxLength={maxLength}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					commit();
				} else if (event.key === "Escape") {
					setDraft(value);
				}
			}}
		/>
	);
}

export interface LayoutOps {
	/** Applies a change to the tree of the collection as it is when the change runs. */
	readonly change: (next: (tree: Tree) => Tree) => void;
	readonly tree: Tree;
	readonly showTabs: boolean;
	readonly disabled: boolean;
}

/** A group of the panel as a row of the tree: its title is edited in place, its fields sit under it. */
export function GroupRow({ ops, tab, block }: { ops: LayoutOps; tab: number; block: number }) {
	const t = useTranslator(schemaFieldsMessages);
	const site = useSite();
	const group = ops.tree.tabs[tab]?.blocks[block];
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: groupId(tab, block),
		disabled: ops.disabled,
	});
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [moving, setMoving] = useState(false);
	if (!group || group.title === null) return null;
	const ref = { tab, block };
	const _count = ops.tree.tabs[tab]?.blocks.length ?? 0;
	const buttons: RowButton[] = [
		{
			label: t("layout.collapseToggle", { name: group.title }),
			icon: CollapseAll,
			pressed: group.collapsed === true,
			disabled: ops.disabled,
			onClick: () => ops.change((tree) => editGroup(tree, ref, { collapsed: !group.collapsed })),
		},
		...(ops.showTabs
			? [
					{
						label: t("layout.moveGroup", { name: group.title }),
						icon: ArrowRight,
						disabled: ops.disabled,
						onClick: () => setMoving(true),
					},
				]
			: []),
		{
			label: t("layout.removeGroup", { name: group.title }),
			icon: TrashCan,
			destructive: true,
			disabled: ops.disabled,
			onClick: () => ops.change((tree) => removeGroup(tree, ref)),
		},
	];
	return (
		<FieldRow
			ref={setNodeRef}
			group
			data-testid={`group-${tab}-${block}`}
			motion={{ transform: CSS.Translate.toString(transform) ?? undefined, transition }}
			dragging={isDragging}
			grip={!ops.disabled}
			gripProps={{
				ref: setActivatorNodeRef,
				...attributes,
				...listeners,
				"aria-label": t("layout.dragGroup", { name: group.title }),
			}}
			name={
				<>
					<InlineName
						value={group.title}
						label={t("layout.groupTitle")}
						disabled={ops.disabled}
						inputRef={inputRef}
						onCommit={(title) => ops.change((tree) => editGroup(tree, ref, { title }))}
					/>
					{group.collapsed && (
						<Text variant="caption" tone="muted">
							{t("layout.collapsedMark")}
						</Text>
					)}
				</>
			}
		>
			<RowButtons buttons={buttons} />
			{moving && (
				<MoveDialog
					title={t("layout.moveGroupTitle", { name: group.title })}
					destinations={ops.tree.tabs.flatMap((item, at): Destination[] =>
						at === tab
							? []
							: [
									{
										label: at === 0 ? (ops.tree.defaultTab ?? tabLabel(site, item.name)) : item.name,
										run: () => ops.change((tree) => moveGroupToTab(tree, ref, at)),
									},
								],
					)}
					onClose={() => setMoving(false)}
				/>
			)}
		</FieldRow>
	);
}

/** The place to drop a field into a group that has none, or after the last block of a tab. */
export function DropRow({ id, label, testId }: { id: string; label?: string; testId: string }) {
	const { setNodeRef, transform, transition } = useSortable({ id, disabled: { draggable: true } });
	return (
		<li
			ref={setNodeRef}
			// design-allow: dnd-kit moves the row while it is dragged
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={label ? "list-none px-monti-12 py-monti-8 text-monti-caption text-monti-muted" : "h-0 list-none"}
			data-testid={testId}
		>
			{label}
		</li>
	);
}
