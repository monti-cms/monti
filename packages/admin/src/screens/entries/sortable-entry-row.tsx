"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslator } from "@monti-cms/core/site";
import { DragHandle, IconButton, OrderedRow, Text } from "@monti-cms/ui";
import { ArrowDown, ArrowUp, Close } from "@monti-cms/ui/icons";
import { commonMessages } from "../../lib/common.messages";
import { entriesMessages } from "./messages";
import type { RelationEntry } from "./use-relation-search";

type EntryOption = RelationEntry;

/** One row of an ordered list. Move it by dragging the handle or with the up/down buttons. */
export function SortableEntryRow({
	sortableId,
	index,
	count,
	option,
	disabled,
	onMove,
	onRemove,
}: {
	sortableId: string;
	index: number;
	count: number;
	option: EntryOption | undefined;
	disabled: boolean;
	onMove: (direction: -1 | 1) => void;
	onRemove: () => void;
}) {
	const t = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: sortableId,
		disabled,
	});
	const title = option?.title ?? tc("loading");
	return (
		<OrderedRow
			ref={setNodeRef}
			drag={{ transform: CSS.Translate.toString(transform), transition, active: isDragging }}
			handle={
				<DragHandle
					ref={setActivatorNodeRef}
					aria-label={t("entry.drag", { title })}
					disabled={disabled}
					{...attributes}
					{...listeners}
				/>
			}
			actions={
				<>
					<IconButton label={t("entry.up", { title })} disabled={disabled || index === 0} onClick={() => onMove(-1)}>
						<ArrowUp />
					</IconButton>
					<IconButton
						label={t("entry.down", { title })}
						disabled={disabled || index === count - 1}
						onClick={() => onMove(1)}
					>
						<ArrowDown />
					</IconButton>
					<IconButton label={t("entry.remove", { title })} disabled={disabled} onClick={onRemove}>
						<Close />
					</IconButton>
				</>
			}
		>
			<Text variant="caption" truncate>
				{index + 1}. {title}
				{/* Unpublished posts are missing from the collection's public list. */}
				{option && option.status !== "published" && option.status !== "missing" && (
					<Text tone="warning"> {t("entry.unpublished")}</Text>
				)}
			</Text>
		</OrderedRow>
	);
}
