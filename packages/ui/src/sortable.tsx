"use client";

import {
	type Announcements,
	type ClientRect,
	type CollisionDetection,
	closestCenter,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DroppableContainer,
	type KeyboardCoordinateGetter,
	KeyboardSensor,
	MeasuringStrategy,
	PointerSensor,
	pointerWithin,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	horizontalListSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUiLabels } from "./labels";

/**
 * The look of the thing in hand while it is dragged, the same in every list (a field row, a group, a folder tab, a choice, a language): it lies on
 * the page ground with the floating shadow, over the rows it passes.
 */
export const HELD = "relative z-10 bg-monti-page shadow-monti-floating";

/** The place the thing in hand left in its list while its floating copy follows the pointer: kept as a gap the others move around. */
export const SLOT = "opacity-0";

/** One sortable thing as a drag reports it: its id and the id of the {@link SortableList} it sits in. */
export interface SortableRef {
	id: string;
	list: string | null;
}

/** A moment of a drag: what is in hand, what it is over, and whether its middle is past the middle of that (it goes after it). */
export interface SortableEvent {
	active: SortableRef;
	over: SortableRef | null;
	below: boolean;
}

const refOf = (entry: { id: string | number; data: { current?: Record<string, unknown> | null } }): SortableRef => ({
	id: String(entry.id),
	list: ((entry.data.current?.sortable as { containerId?: string | number } | undefined)?.containerId ?? null) as
		| string
		| null,
});

const area = (rect: ClientRect | undefined) => (rect ? rect.width * rect.height : Number.POSITIVE_INFINITY);

const fill = (template: string, values: Record<string, string>) =>
	template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

/** Only the droppables `accepts` lets the thing in hand go to, as the map the keyboard coordinates read. */
const onlyAccepted = (
	containers: { getEnabled(): DroppableContainer[]; get(id: string | number): DroppableContainer | undefined },
	keep: (entry: DroppableContainer) => boolean,
) => ({
	getEnabled: () => containers.getEnabled().filter(keep),
	get: (id: string | number) => containers.get(id),
});

/**
 * Where things are dragged to a new place (rows, tabs, choices: list.md, section on dragging). The whole thing in hand follows the pointer and the
 * others make room for it while it moves, so the new order shows before it is dropped; the keyboard does the same (Space lifts, the arrows
 * move, Space drops, Esc puts it back). Put one or more {@link SortableList}s inside, and give each thing {@link useSortableItem}.
 *
 * `nameOf` names a thing for the screen reader's announcements (their words are the `sort*` labels of `UiLabelsProvider`). `accepts` says where the
 * thing in hand may go (another list, a tab header); without it, anywhere. `onOver` is each new place while it moves, for a screen that moves it
 * into another list on the way; `onDrop` is the drop, `onCancel` the drag put back. Esc during a drag only puts the thing back: it does not reach a
 * sheet or a menu the list sits in.
 *
 * `overlay` draws the thing in hand (the part with `lifted`) on the page, over everything and outside every box, so nothing clips it and the
 * page does not scroll sideways; its place in the list stays as a gap (`dragging`).
 */
function Sortable({
	nameOf,
	accepts,
	onStart,
	onOver,
	onDrop,
	onCancel,
	overlay,
	children,
}: {
	nameOf: (id: string) => string;
	accepts?: (active: SortableRef, target: SortableRef) => boolean;
	onStart?: (active: SortableRef) => void;
	onOver?: (event: SortableEvent) => void;
	onDrop: (event: SortableEvent) => void;
	onCancel?: () => void;
	overlay?: (active: SortableRef) => ReactNode;
	children: ReactNode;
}) {
	const [inHand, setInHand] = useState<SortableRef | null>(null);
	const labels = useUiLabels();
	const dragging = useRef(false);
	const accept = useRef(accepts);
	accept.current = accepts;

	const keyboard: KeyboardCoordinateGetter = useMemo(
		() => (event, args) => {
			const { active } = args.context;
			const check = accept.current;
			if (!active || !check) return sortableKeyboardCoordinates(event, args);
			const from = refOf(active);
			return sortableKeyboardCoordinates(event, {
				...args,
				context: {
					...args.context,
					droppableContainers: onlyAccepted(args.context.droppableContainers, (entry) =>
						check(from, refOf(entry)),
					) as typeof args.context.droppableContainers,
				},
			});
		},
		[],
	);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: keyboard }),
	);

	// The pointer's own target first, the smallest one (a field inside a group before the group); away from every target, the nearest.
	const collisions: CollisionDetection = useMemo(
		() => (args) => {
			const check = accept.current;
			const from = refOf(args.active);
			const droppableContainers = check
				? args.droppableContainers.filter((entry) => check(from, refOf(entry)))
				: args.droppableContainers;
			const within = pointerWithin({ ...args, droppableContainers });
			if (within.length > 0) {
				const smallest = [...within].sort(
					(a, b) => area(args.droppableRects.get(a.id)) - area(args.droppableRects.get(b.id)),
				);
				return smallest.slice(0, 1);
			}
			return closestCenter({ ...args, droppableContainers });
		},
		[],
	);

	// Esc while something is in hand puts it back and stops there, so a sheet or menu around the list stays open. The drag hears a stand-in key.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!dragging.current || event.key !== "Escape" || !event.isTrusted) return;
			event.stopPropagation();
			event.preventDefault();
			document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Unidentified", bubbles: true }));
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, []);

	const name = (id: string | number | undefined) => (id === undefined ? "" : nameOf(String(id)));
	const announcements: Announcements = {
		onDragStart: ({ active }) => fill(labels.sortLifted, { name: name(active.id) }),
		onDragOver: ({ active, over }) =>
			over ? fill(labels.sortOver, { name: name(active.id), over: name(over.id) }) : undefined,
		onDragEnd: ({ active, over }) =>
			over
				? fill(labels.sortDropped, { name: name(active.id), over: name(over.id) })
				: fill(labels.sortCancelled, { name: name(active.id) }),
		onDragCancel: ({ active }) => fill(labels.sortCancelled, { name: name(active.id) }),
	};

	const event = ({ active, over }: DragOverEvent | DragEndEvent): SortableEvent => {
		const moved = active.rect.current.translated;
		return {
			active: refOf(active),
			over: over ? refOf(over) : null,
			below: Boolean(over && moved && moved.top + moved.height / 2 > over.rect.top + over.rect.height / 2),
		};
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={collisions}
			measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
			accessibility={{ announcements, screenReaderInstructions: { draggable: labels.sortInstructions } }}
			onDragStart={({ active }) => {
				dragging.current = true;
				setInHand(refOf(active));
				onStart?.(refOf(active));
			}}
			onDragOver={(each) => onOver?.(event(each))}
			onDragEnd={(each) => {
				dragging.current = false;
				setInHand(null);
				onDrop(event(each));
			}}
			onDragCancel={() => {
				dragging.current = false;
				setInHand(null);
				onCancel?.();
			}}
		>
			{children}
			{overlay &&
				typeof document !== "undefined" &&
				createPortal(<DragOverlay>{inHand ? overlay(inHand) : null}</DragOverlay>, document.body)}
		</DndContext>
	);
}

/** One list of things that trade places: `items` are their ids in order; `id` names the list, as {@link SortableRef} `list` reports it. */
function SortableList({
	id,
	items,
	direction = "vertical",
	children,
}: {
	id: string;
	items: string[];
	direction?: "vertical" | "horizontal";
	children: ReactNode;
}) {
	return (
		<SortableContext
			id={id}
			items={items}
			strategy={direction === "horizontal" ? horizontalListSortingStrategy : verticalListSortingStrategy}
		>
			{children}
		</SortableContext>
	);
}

/**
 * One thing of a {@link SortableList}. Give `ref` to the whole thing (the row, the tab: what moves) and `handle` to what it is dragged by (a grip's
 * `gripProps`, a `DragHandle`). With `{ handle: false }` the whole thing is its own handle (a folder tab): spread `handle` on it too, and `ref` is
 * both. `motion` moves it (making room for another, or its gap moving), `held` is the thing in hand (its gap, while the {@link Sortable} `overlay`
 * draws it), `over` is true while something is over it.
 */
function useSortableItem(id: string, options: { disabled?: boolean; handle?: boolean } = {}) {
	const { disabled = false, handle = true } = options;
	const sortable = useSortable({ id, disabled });
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } =
		sortable;
	const ref = (node: HTMLElement | null) => {
		setNodeRef(node);
		if (!handle) setActivatorNodeRef(node);
	};
	return {
		ref,
		handle: {
			...(handle ? { ref: setActivatorNodeRef } : {}),
			...listeners,
			"aria-describedby": attributes["aria-describedby"],
		},
		motion: transform || transition ? { transform: CSS.Translate.toString(transform), transition } : undefined,
		held: isDragging,
		over: isOver,
	};
}

export { Sortable, SortableList, useSortableItem };
