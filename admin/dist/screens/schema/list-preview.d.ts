import { type Obj } from "./schema-model.js";
/**
 * The entry list as the choice of columns would show it: the latest entries of the collection when it has some, else sample rows. Only the header and the cells
 * are drawn (no sorting, filters or paging), enough to see which columns appear and in what order.
 */
export declare function ListPreview({ name, collection, columns, saved, }: {
    name: string;
    collection: Obj;
    /** The columns being chosen; `undefined` for the usual ones. */
    columns: readonly string[] | undefined;
    /** Whether the collection is in the file on disk, so it can have entries. */
    saved: boolean;
}): import("react").JSX.Element;
