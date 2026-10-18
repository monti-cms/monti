import type { SuggestedTransform } from "@monti-cms/core/internal/schema-change";
import type { RenameInput, SchemaEditPreview, SchemaSaveResult, SchemaScreenState } from "@monti-cms/core/internal/schema-edit";
import type { Site } from "@monti-cms/core/site";
/** The calls of the schema settings screen (see the `/v1/schema` routes of the admin API). */
/** Query keys. */
export declare const schemaKeys: {
    all: readonly ["cms", "schema"];
    state: () => readonly ["cms", "schema", "state"];
};
export type { RenameInput, SchemaEditPreview, SchemaScreenState, SuggestedTransform };
export type SavedSchema = Extract<SchemaSaveResult, {
    saved: true;
}>;
/** The schema file as the screen edits it. */
export declare const fetchSchema: (site: Site, signal?: AbortSignal) => Promise<SchemaScreenState>;
/** What the screen sends to check or save an edit. `transforms` left out means the server's defaults. */
export interface EditRequest {
    readonly schema: unknown;
    readonly transforms?: readonly SuggestedTransform[];
    readonly renames: readonly RenameInput[];
}
export declare const previewSchema: (site: Site, request: EditRequest, signal?: AbortSignal) => Promise<SchemaEditPreview>;
/**
 * Saves an edit. `acknowledged` names the impacts of the preview the writer saw: the server refuses a save whose changes leave stored entries worse off
 * unless their keys are here (`schema_unacknowledged`).
 */
export declare const saveSchema: (site: Site, request: EditRequest & {
    readonly baseHash: string;
    readonly acknowledged: readonly string[];
}) => Promise<{
    readonly saved: true;
    readonly file: string;
    readonly hash: string;
    readonly transforms: readonly import("@monti-cms/core").SchemaMigration[];
    readonly entriesRewritten: number;
    readonly reloaded: boolean;
    readonly conflicts: number;
} | {
    saved: false;
    reason: "unchanged";
}>;
