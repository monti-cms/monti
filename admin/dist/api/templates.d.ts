import type { StoredDocument } from "@monti-cms/core/document";
import type { BodyTemplate, Site } from "@monti-cms/core/site";
/** Query keys. Everything under `all` is refetched after a template changes. */
export declare const templatesKeys: {
    all: readonly ["cms", "templates"];
    list: () => readonly ["cms", "templates", "list"];
};
/** The body templates, newest first. */
export declare const listTemplates: (site: Site, signal?: AbortSignal, fallback?: string) => Promise<BodyTemplate[]>;
export declare const createTemplate: (site: Site, input: {
    name: string;
    doc: StoredDocument;
}, fallback?: string) => Promise<BodyTemplate>;
export declare const updateTemplate: (site: Site, id: string, input: {
    name: string;
    doc: StoredDocument;
    expectedVersion: number | undefined;
}, fallback?: string) => Promise<BodyTemplate>;
export declare const deleteTemplate: (site: Site, template: Pick<BodyTemplate, "id" | "version">, fallback?: string) => Promise<unknown>;
