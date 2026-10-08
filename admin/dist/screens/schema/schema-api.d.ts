import { type Site } from "@monti-cms/core/client";
import type { SuggestedTransform } from "@monti-cms/core/schema-change";
import type { RenameInput, SchemaEditPreview, SchemaSaveResult, SchemaScreenState } from "@monti-cms/core/schema-edit";
/** The calls of the schema settings screen (see the `/v1/schema` routes of the admin API). */
export declare const SCHEMA_KEY: readonly ["cms", "schema"];
export type { RenameInput, SchemaEditPreview, SchemaScreenState, SuggestedTransform };
export type SavedSchema = Extract<SchemaSaveResult, {
    saved: true;
}>;
export declare const fetchSchema: (site: Site, signal?: AbortSignal) => Promise<SchemaScreenState>;
/** What the screen sends to check or save an edit. `transforms` left out means the server's defaults. */
export interface EditRequest {
    readonly schema: unknown;
    readonly transforms?: readonly SuggestedTransform[];
    readonly renames: readonly RenameInput[];
}
export declare const previewSchema: (site: Site, request: EditRequest, signal?: AbortSignal) => Promise<SchemaEditPreview>;
export declare const saveSchema: (site: Site, request: EditRequest & {
    readonly baseHash: string;
}) => Promise<{
    readonly saved: true;
    readonly file: string;
    readonly hash: string;
    readonly schemaVersion: number;
    readonly transforms: readonly import("@monti-cms/core/schema-change").SchemaMigration[];
    readonly entriesRewritten: number;
    readonly types: {
        readonly file: string;
        readonly changed: boolean;
    };
    readonly reloaded: boolean;
    readonly conflicts: number;
} | {
    saved: false;
    reason: "unchanged";
}>;
