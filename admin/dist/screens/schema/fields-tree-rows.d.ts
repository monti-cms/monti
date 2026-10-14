import { ArrowUp } from "lucide-react";
import type { CollectionEditing } from "./field-editor.js";
import { type KindTone } from "./field-summary.js";
import { type FieldPlace, type Obj } from "./schema-model.js";
/** The colour of a kind token in the tree: one family per meaning, light and dark. */
export declare const TONE: Record<KindTone, string>;
export declare const REQUIRED = "text-[#B45309] cms-dark:text-[#FCD34D]";
export declare const OPTION = "text-[#9A3412] cms-dark:text-[#FDBA74]";
export declare const columnsOf: (compact: boolean) => "grid grid-cols-[minmax(0,300px)_8.75rem_minmax(0,1fr)] items-center gap-x-4" | "grid grid-cols-[minmax(0,360px)_8.75rem] items-center gap-x-4";
export interface TreeContext {
    readonly editing: CollectionEditing;
    readonly onOpen: (place: FieldPlace, name: string) => void;
    /** The settings column is left out (the preview is beside the tree). */
    readonly compact: boolean;
}
/** Why a top-level row cannot be moved or grouped. */
export type Locked = {
    readonly kind: "plugin";
    readonly tab: string;
} | {
    readonly kind: "panel";
};
/** A place a row can be moved to from the move dialog (the keyboard and touch alternative to dragging). */
export interface Destination {
    readonly label: string;
    readonly disabled?: boolean;
    readonly run: () => void;
}
/** One icon button of a row: shown on hover and while focus is inside the row, without moving anything. */
export interface RowButton {
    readonly label: string;
    readonly icon: typeof ArrowUp;
    readonly onClick: () => void;
    readonly disabled?: boolean;
    readonly destructive?: boolean;
    readonly pressed?: boolean;
}
export declare function RowButtons({ buttons }: {
    buttons: RowButton[];
}): import("react").JSX.Element;
/** Where a row can go, as a list to pick from. */
export declare function MoveDialog({ title, destinations, onClose, }: {
    title: string;
    destinations: Destination[];
    onClose: () => void;
}): import("react").JSX.Element;
/** What a top-level row does besides what a field in a conditional branch does: it moves through the tree of tabs and groups. */
export interface TopRow {
    readonly locked: Locked | null;
    /** The row is in a group: a rule along its left edge shows it, there is no indent. */
    readonly member: boolean;
    /** Places the row can be moved to without dragging. */
    readonly destinations: Destination[];
    readonly up: () => void;
    readonly down: () => void;
    readonly canUp: boolean;
    readonly canDown: boolean;
}
export declare function Row({ ctx, place, name, field, prefix, childLead, nested, index, count, top, }: {
    ctx: TreeContext;
    place: FieldPlace;
    name: string;
    field: Obj;
    prefix: string;
    childLead: string;
    nested: boolean;
    index: number;
    count: number;
    top?: TopRow;
}): import("react").JSX.Element;
/** One list of fields (the top level, or the fields of one option): rows that can be dragged within the list. */
export declare function FieldGroup({ ctx, place, fields, lead, nested, }: {
    ctx: TreeContext;
    place: FieldPlace;
    fields: Record<string, Obj>;
    /** The tree lines in front of the rows (`null` at the top level, where there are none). */
    lead: string | null;
    nested: boolean;
}): import("react").JSX.Element;
