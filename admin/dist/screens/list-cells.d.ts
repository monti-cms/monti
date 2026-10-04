import type { ComponentType } from "react";
import type { CmsAdminComponents, ListCellProps } from "../admin-components.js";
/**
 * Finds a column's cell component in the admin extension (`listCells`). The column name comes first, otherwise the field's `input` name.
 * `undefined` if none (the default cell is drawn).
 */
export declare function customListCell(listCells: CmsAdminComponents["listCells"], collection: string, column: string): ComponentType<ListCellProps> | undefined;
/**
 * Default cell of a field column. Relations show names (chips if several), select shows the option label, text and media show the stored text.
 * `—` when there is no value. Dates are drawn separately by the system columns (updated, created, published).
 */
export declare function DefaultFieldCell({ collection, column, entry }: ListCellProps): string | import("react").JSX.Element;
