import type { Folder, ListEntriesItem } from "@monti-cms/core/runtime";
import { type AdminListColumn } from "./list-columns.js";
interface EntryCellProps {
    collection: string;
    column: AdminListColumn;
    item: ListEntriesItem;
    folders: Folder[];
    isTrash: boolean;
    isRecord: boolean;
    /** Append the folder path small next to the title (flat view with the folder column off). */
    showFolderBesideTitle: boolean;
    onOpenRecord: (item: ListEntriesItem) => void;
}
/** One cell of the entries table. Cells registered by admin extensions (`listCells`) take precedence over default cells. */
export declare function EntryCell(props: EntryCellProps): import("react").JSX.Element;
export {};
