import { type AdminListColumn } from "./list-columns.js";
export declare function ColumnSettingsPopover({ collection, order, visibility, onToggle, onMove, }: {
    collection: string;
    order: AdminListColumn[];
    visibility: Record<string, boolean>;
    onToggle: (column: AdminListColumn, visible: boolean) => void;
    onMove: (column: AdminListColumn, direction: -1 | 1) => void;
}): import("react").JSX.Element;
