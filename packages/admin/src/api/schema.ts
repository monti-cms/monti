import type { SuggestedTransform } from "@monti-cms/core/internal/schema-change";
import type {
	RenameInput,
	SchemaEditPreview,
	SchemaSaveResult,
	SchemaScreenState,
} from "@monti-cms/core/internal/schema-edit";
import type { Site } from "@monti-cms/core/site";
import { adminFetch } from "./client";

/** The calls of the schema settings screen (see the `/v1/schema` routes of the admin API). */

/** Query keys. */
export const schemaKeys = {
	all: ["cms", "schema"] as const,
	state: () => [...schemaKeys.all, "state"] as const,
};

export type { RenameInput, SchemaEditPreview, SchemaScreenState, SuggestedTransform };
export type SavedSchema = Extract<SchemaSaveResult, { saved: true }>;

/** The schema file as the screen edits it. */
export const fetchSchema = (site: Site, signal?: AbortSignal) =>
	adminFetch<SchemaScreenState>(site, "/v1/schema", { signal });

/** What the screen sends to check or save an edit. `transforms` left out means the server's defaults. */
export interface EditRequest {
	readonly schema: unknown;
	readonly transforms?: readonly SuggestedTransform[];
	readonly renames: readonly RenameInput[];
}

export const previewSchema = (site: Site, request: EditRequest, signal?: AbortSignal) =>
	adminFetch<SchemaEditPreview>(site, "/v1/schema/preview", { method: "POST", json: request, signal });

/**
 * Saves an edit. `acknowledged` names the impacts of the preview the writer saw: the server refuses a save whose changes leave stored entries worse off
 * unless their keys are here (`schema_unacknowledged`).
 */
export const saveSchema = (
	site: Site,
	request: EditRequest & { readonly baseHash: string; readonly acknowledged: readonly string[] },
) =>
	adminFetch<SavedSchema | { saved: false; reason: "unchanged" }>(site, "/v1/schema", {
		method: "PUT",
		json: request,
	});
