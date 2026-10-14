import { cmsApiUrl } from "@monti-cms/core/client";
import { cmsFetch } from "./client.js";
/** Query keys. Everything under `all` is refetched after a template changes. */
export const templatesKeys = {
    all: ["cms", "templates"],
    list: () => [...templatesKeys.all, "list"],
};
/** The body templates, newest first. */
export const listTemplates = async (site, signal, fallback) => (await cmsFetch(site, cmsApiUrl("/v1/templates"), { signal, fallback })).items ?? [];
export const createTemplate = (site, input, fallback) => cmsFetch(site, cmsApiUrl("/v1/templates"), { method: "POST", json: input, fallback });
export const updateTemplate = (site, id, input, fallback) => cmsFetch(site, cmsApiUrl(`/v1/templates/${encodeURIComponent(id)}`), {
    method: "PATCH",
    json: input,
    fallback,
});
export const deleteTemplate = (site, template, fallback) => cmsFetch(site, cmsApiUrl(`/v1/templates/${encodeURIComponent(template.id)}?${new URLSearchParams({ expectedVersion: String(template.version) })}`), { method: "DELETE", fallback });
