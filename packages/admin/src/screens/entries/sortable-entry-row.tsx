"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslator } from "@monti-cms/core/site";
import { cn, Text } from "@monti-cms/ui";
import { IconButton } from "@monti-cms/ui/internal";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
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
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn(
				"flex items-center gap-tight rounded-md border border-monti-muted bg-monti-page px-tight py-tight text-monti-caption",
				isDragging && "relative z-10 shadow-monti-floating",
			)}
		>
			<IconButton
				ref={setActivatorNodeRef}
				size="icon-xs"
				label={t("entry.drag", { title })}
				disabled={disabled}
				className="cursor-grab touch-none active:cursor-grabbing"
				{...attributes}
				{...listeners}
			>
				<GripVertical />
			</IconButton>
			<Text variant="caption" truncate>
				{index + 1}. {title}
				{/* Unpublished posts are missing from the collection's public list. */}
				{option && option.status !== "published" && option.status !== "missing" && (
					<Text tone="warning"> {t("entry.unpublished")}</Text>
				)}
			</Text>
			<IconButton
				size="icon-xs"
				label={t("entry.up", { title })}
				disabled={disabled || index === 0}
				onClick={() => onMove(-1)}
			>
				<ArrowUp />
			</IconButton>
			<IconButton
				size="icon-xs"
				label={t("entry.down", { title })}
				disabled={disabled || index === count - 1}
				onClick={() => onMove(1)}
			>
				<ArrowDown />
			</IconButton>
			<IconButton size="icon-xs" label={t("entry.remove", { title })} disabled={disabled} onClick={onRemove}>
				<X />
			</IconButton>
		</li>
	);
}
