import { adminFetch } from "./client.js";
export const importKeys = {
    all: ["cms", "import"],
    limit: () => [...importKeys.all, "limit"],
};
/** The largest zip the server takes, in bytes (the meta route's `limits.importBytes`). `undefined` when it does not say. */
export const getImportLimit = async (site, signal) => {
    const meta = await adminFetch(site, "/v1/meta", { signal });
    return meta.limits?.importBytes;
};
const formOf = (file, mode, mapping, publish) => {
    const form = new FormData();
    form.set("file", file);
    form.set("mode", mode);
    if (mapping)
        form.set("mapping", JSON.stringify(mapping));
    if (publish)
        form.set("publish", "true");
    return form;
};
/** What importing the file would do. Nothing is written. Without a `mapping`, a collection goes to the one of the same name. */
export const previewEntryImport = (site, file, mapping, signal) => adminFetch(site, "/v1/import/entries", {
    method: "POST",
    form: formOf(file, "preview", mapping, false),
    signal,
});
/** Imports the file as new entries. The answer holds each entry's result; a single entry failing does not fail the request. */
export const runEntryImport = (site, file, mapping, publish) => adminFetch(site, "/v1/import/entries", { method: "POST", form: formOf(file, "run", mapping, publish) });
