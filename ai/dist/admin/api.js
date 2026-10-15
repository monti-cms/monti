import { cmsFetch } from "@monti-cms/admin/api";
import { cmsApiUrl } from "@monti-cms/core/client";
export const aiKeys = {
    all: ["cms", "ai"],
    actions: () => [...aiKeys.all, "actions"],
    settings: () => [...aiKeys.all, "settings"],
    snippets: () => [...aiKeys.all, "snippets"],
    models: (source) => [...aiKeys.all, "models", source],
};
const segment = (value) => encodeURIComponent(value);
/** `GET /v1/ai/actions` */
export const listAiActions = (site, options = {}) => cmsFetch(site, cmsApiUrl("/v1/ai/actions"), options);
/** `POST /v1/ai/actions` (creates a screen action). */
export const createAiAction = (site, json, fallback) => cmsFetch(site, cmsApiUrl("/v1/ai/actions"), { method: "POST", json, fallback });
/** `PATCH /v1/ai/actions/:key` */
export const updateAiAction = (site, key, json, fallback) => cmsFetch(site, cmsApiUrl(`/v1/ai/actions/${segment(key)}`), { method: "PATCH", json, fallback });
/** `DELETE /v1/ai/actions/:key` */
export const deleteAiAction = (site, key, expectedVersion, fallback) => cmsFetch(site, cmsApiUrl(`/v1/ai/actions/${segment(key)}?expectedVersion=${expectedVersion}`), {
    method: "DELETE",
    fallback,
});
/** `GET /v1/ai/settings` */
export const getAiSettings = (site, options = {}) => cmsFetch(site, cmsApiUrl("/v1/ai/settings"), options);
/** `POST /v1/ai/providers` */
export const createAiProvider = (site, json, fallback) => cmsFetch(site, cmsApiUrl("/v1/ai/providers"), { method: "POST", json, fallback });
/** `PATCH /v1/ai/providers/:id` */
export const updateAiProvider = (site, id, json, fallback) => cmsFetch(site, cmsApiUrl(`/v1/ai/providers/${segment(id)}`), { method: "PATCH", json, fallback });
/** `DELETE /v1/ai/providers/:id` */
export const deleteAiProvider = (site, id, expectedVersion, fallback) => cmsFetch(site, cmsApiUrl(`/v1/ai/providers/${segment(id)}?expectedVersion=${expectedVersion}`), {
    method: "DELETE",
    fallback,
});
/** `POST /v1/ai/providers/check` */
export const checkAiProvider = (site, json, fallback) => cmsFetch(site, cmsApiUrl("/v1/ai/providers/check"), { method: "POST", json, fallback });
/** `POST /v1/ai/models` */
export const listAiModels = (site, source, options = {}) => cmsFetch(site, cmsApiUrl("/v1/ai/models"), { method: "POST", json: source, ...options });
/** `GET /v1/ai/snippets` */
export const getAiSnippets = (site, options = {}) => cmsFetch(site, cmsApiUrl("/v1/ai/snippets"), options);
/** `POST /v1/ai/snippets` */
export const createAiSnippet = (site, json, fallback) => cmsFetch(site, cmsApiUrl("/v1/ai/snippets"), { method: "POST", json, fallback });
/** `PATCH /v1/ai/snippets` */
export const updateAiSnippet = (site, json, fallback) => cmsFetch(site, cmsApiUrl("/v1/ai/snippets"), { method: "PATCH", json, fallback });
/** `DELETE /v1/ai/snippets?key=&expectedVersion=` */
export const deleteAiSnippet = (site, key, expectedVersion, fallback) => cmsFetch(site, cmsApiUrl(`/v1/ai/snippets?key=${segment(key)}&expectedVersion=${expectedVersion}`), {
    method: "DELETE",
    fallback,
});
/** `POST /v1/ai/run` with one input. */
export const runAiOnce = (site, json, options) => cmsFetch(site, cmsApiUrl("/v1/ai/run"), { method: "POST", json, ...options });
/** `POST /v1/ai/run` with several inputs. */
export const runAiMany = (site, json, options) => cmsFetch(site, cmsApiUrl("/v1/ai/run"), { method: "POST", json, ...options });
/** `POST /v1/ai/run` as a stream: the raw response, which the caller reads line by line. */
export const openAiRunStream = (json, signal) => fetch(cmsApiUrl("/v1/ai/run"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
    signal,
});
