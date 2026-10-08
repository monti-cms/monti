import type { BodyTemplate } from "../../../core/store/types.js";
import { type StoreContext } from "./context.js";
/**
 * Body templates, stored as documents. Picked from `새 글`; changing one does not affect entries already created.
 * The initial templates come from the site config (`seed.templates`), inserted once by a migration.
 */
export declare function createTemplateOps(ctx: StoreContext): {
    listTemplates: () => Promise<BodyTemplate[]>;
    getTemplate: (id: string) => Promise<BodyTemplate>;
    createTemplate: (data: {
        name: string;
        doc?: unknown;
    }) => Promise<BodyTemplate>;
    updateTemplate: (params: {
        id: string;
        expectedVersion: number;
        name?: string;
        doc?: unknown;
    }) => Promise<BodyTemplate>;
    deleteTemplate: (params: {
        id: string;
        expectedVersion: number;
    }) => Promise<void>;
};
