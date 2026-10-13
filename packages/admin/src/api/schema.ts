import { cmsApiUrl, type Site } from "@monti-cms/core/client";
import type { SuggestedTransform } from "@monti-cms/core/schema-change";
import type { RenameInput, SchemaEditPreview, SchemaSaveResult, SchemaScreenState } from "@monti-cms/core/schema-edit";
import { cmsFetch } from "../admin-api";

/** The calls of the schema settings screen (see the `/v1/schema` routes of the admin API). */

export const SCHEMA_KEY = ["cms", "schema"] as const;

export type { RenameInput, SchemaEditPreview, SchemaScreenState, SuggestedTransform };
export type SavedSchema = Extract<SchemaSaveResult, { saved: true }>;

export const fetchSchema = (site: Site, signal?: AbortSignal) =>
	cmsFetch<SchemaScreenState>(site, cmsApiUrl("/v1/schema"), { signal });

/** What the screen sends to check or save an edit. `transforms` left out means the server's defaults. */
export interface EditRequest {
	readonly schema: unknown;
	readonly transforms?: readonly SuggestedTransform[];
	readonly renames: readonly RenameInput[];
}

export const previewSchema = (site: Site, request: EditRequest, signal?: AbortSignal) =>
	cmsFetch<SchemaEditPreview>(site, cmsApiUrl("/v1/schema/preview"), { method: "POST", json: request, signal });

export const saveSchema = (site: Site, request: EditRequest & { readonly baseHash: string }) =>
	cmsFetch<SavedSchema | { saved: false; reason: "unchanged" }>(site, cmsApiUrl("/v1/schema"), {
		method: "PUT",
		json: request,
	});
