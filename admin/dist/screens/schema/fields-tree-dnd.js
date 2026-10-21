"use client";
import { jsx as _jsx } from "react/jsx-runtime";
// Dragging in the fields tree: the dnd-kit sensors, the sortable list of a conditional field's branch, the layout's drag-and-drop context,
// and the ids and drop handler that turn a drag of tabs, groups and fields into a change of the layout tree.
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { dropFieldOnField, moveGroup, placeField, placeOf, placeUngrouped } from "./layout-model.js";
export const groupId = (tab, block) => `group:${tab}:${block}`;
export const emptyId = (tab, block) => `empty:${tab}:${block}`;
export const tabId = (tab) => `tab:${tab}`;
export const endId = (tab) => `end:${tab}`;
const parseBlockId = (id, kind) => {
    const match = new RegExp(`^${kind}:(\\d+):(\\d+)$`).exec(id);
    return match ? { tab: Number(match[1]), block: Number(match[2]) } : null;
};
const parseTabId = (id) => {
    const match = /^(?:tab|end):(\d+)$/.exec(id);
    return match ? Number(match[1]) : null;
};
/** Rows that can be dragged within one list (the fields of one option): a drop reports which id went onto which. */
export function SortableList({ items, onDragEnd, children, }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    return (_jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: ({ active, over }) => {
            if (!over || active.id === over.id)
                return;
            onDragEnd(String(active.id), String(over.id));
        }, children: _jsx(SortableContext, { items: items, strategy: verticalListSortingStrategy, children: children }) }));
}
/** The drop of a tab, group or field row onto another row of the layout, as a change of the tree. */
const dropOnLayout = (current, from, to) => {
    const group = parseBlockId(from, "group");
    const toGroup = parseBlockId(to, "group");
    const toEmpty = parseBlockId(to, "empty");
    const toTab = parseTabId(to);
    if (group) {
        if (toGroup)
            return moveGroup(current, group, toGroup);
        if (toEmpty)
            return moveGroup(current, group, toEmpty);
        if (toTab !== null)
            return moveGroup(current, group, { tab: toTab, block: Number.MAX_SAFE_INTEGER });
        const place = placeOf(current, to);
        return place ? moveGroup(current, group, { tab: place.tab, block: place.block }) : current;
    }
    // A field dropped on a group's title leaves its group for the place just before that group.
    if (toGroup)
        return placeUngrouped(current, from, toGroup.tab, toGroup.block);
    if (toEmpty)
        return placeField(current, from, toEmpty.tab, toEmpty.block);
    if (toTab !== null)
        return placeUngrouped(current, from, toTab, to.startsWith("end:") ? undefined : 0);
    return dropFieldOnField(current, from, to);
};
/** The drag-and-drop context of the layout: every row of `ids` can be dropped on, and a drop writes the tree back through `change`. */
export function LayoutDnd({ ids, change, children, }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const onDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id)
            return;
        const from = String(active.id);
        const to = String(over.id);
        change((current) => dropOnLayout(current, from, to));
    };
    return (_jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: onDragEnd, children: _jsx(SortableContext, { items: ids, strategy: verticalListSortingStrategy, children: children }) }));
}
