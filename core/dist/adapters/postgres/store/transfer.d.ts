import { type StoreContext } from "./context.js";
import type { ExportSnapshot } from "./types.js";
/** Admin export. */
export declare function createTransferOps(ctx: StoreContext): {
    /** Read-only snapshot for export. Entry order is fixed so the same data yields the same result. */
    readExportSnapshot: () => Promise<ExportSnapshot>;
};
