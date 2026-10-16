import type { StoredDocument } from "@monti-cms/core/document";
import type { BodyTemplate } from "@monti-cms/core/site";
import { adminApiUrl, type Site } from "@monti-cms/core/site";
import { adminFetch } from "./client";

/** Query keys. Everything under `all` is refetched after a template changes. */
export const templatesKeys = {
	all: ["cms", "templates"] as const,
	list: () => [...templatesKeys.all, "list"] as const,
};

/** The body templates, newest first. */
export const listTemplates = async (site: Site, signal?: AbortSignal, fallback?: string): Promise<BodyTemplate[]> =>
	(await adminFetch<{ items?: BodyTemplate[] }>(site, adminApiUrl("/v1/templates"), { signal, fallback })).items ?? [];

export const createTemplate = (site: Site, input: { name: string; doc: StoredDocument }, fallback?: string) =>
	adminFetch<BodyTemplate>(site, adminApiUrl("/v1/templates"), { method: "POST", json: input, fallback });

export const updateTemplate = (
	site: Site,
	id: string,
	input: { name: string; doc: StoredDocument; expectedVersion: number | undefined },
	fallback?: string,
) =>
	adminFetch<BodyTemplate>(site, adminApiUrl(`/v1/templates/${encodeURIComponent(id)}`), {
		method: "PATCH",
		json: input,
		fallback,
	});

export const deleteTemplate = (site: Site, template: Pick<BodyTemplate, "id" | "version">, fallback?: string) =>
	adminFetch(
		site,
		adminApiUrl(
			`/v1/templates/${encodeURIComponent(template.id)}?${new URLSearchParams({ expectedVersion: String(template.version) })}`,
		),
		{ method: "DELETE", fallback },
	);
