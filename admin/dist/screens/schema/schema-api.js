import { cmsApiUrl } from "@monti-cms/core/client";
import { cmsFetch } from "../admin-api.js";
/** The calls of the schema settings screen (see the `/v1/schema` routes of the admin API). */
export const SCHEMA_KEY = ["cms", "schema"];
export const fetchSchema = (site, signal) => cmsFetch(site, cmsApiUrl("/v1/schema"), { signal });
export const previewSchema = (site, request, signal) => cmsFetch(site, cmsApiUrl("/v1/schema/preview"), { method: "POST", json: request, signal });
export const saveSchema = (site, request) => cmsFetch(site, cmsApiUrl("/v1/schema"), {
    method: "PUT",
    json: request,
});
