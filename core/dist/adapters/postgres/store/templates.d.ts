import { type StoreContext } from "./context.js";
import type { BodyTemplate } from "./types.js";
/**
 * Body templates. Picked from `새 글`; changing one does not affect entries already created.
 * The initial templates come from the site config (`seed.templates`), inserted once by a migration.
 */
export declare function createTemplateOps(ctx: StoreContext): {
    listTemplates: () => Promise<BodyTemplate[]>;
    getTemplate: (id: string) => Promise<BodyTemplate>;
    createTemplate: (data: {
        name: string;
        mdx: string;
    }) => Promise<BodyTemplate>;
    updateTemplate: (params: {
        id: string;
        expectedVersion: number;
        name?: string;
        mdx?: string;
    }) => Promise<BodyTemplate>;
    deleteTemplate: (params: {
        id: string;
        expectedVersion: number;
    }) => Promise<void>;
};
