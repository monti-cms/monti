import { adminFetch } from "./client.js";
/** Query keys. Everything under `all` is refetched after a template changes. */
export const templatesKeys = {
    all: ["cms", "templates"],
    list: () => [...templatesKeys.all, "list"],
};
/** The body templates, newest first. */
export const listTemplates = async (site, signal, fallback) => (await adminFetch(site, "/v1/templates", { signal, fallback })).items ?? [];
export const createTemplate = (site, input, fallback) => adminFetch(site, "/v1/templates", { method: "POST", json: input, fallback });
export const updateTemplate = (site, id, input, fallback) => adminFetch(site, `/v1/templates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: input,
    fallback,
});
export const deleteTemplate = (site, template, fallback) => adminFetch(site, `/v1/templates/${encodeURIComponent(template.id)}?${new URLSearchParams({ expectedVersion: String(template.version) })}`, { method: "DELETE", fallback });
