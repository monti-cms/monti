import { adminFetch } from "./client.js";
export const restoreKeys = {
    all: ["cms", "restore"],
    state: () => [...restoreKeys.all, "state"],
    /** The preview of one chosen file. Outside the `cms` prefix, so refetching the admin's reads after a restore does not read the file again. */
    preview: (fileNumber) => ["restore-preview", fileNumber],
};
const formOf = (file, mode) => {
    const form = new FormData();
    form.set("file", file);
    form.set("mode", mode);
    return form;
};
export const getRestoreState = (site, signal) => adminFetch(site, "/v1/import/restore", { signal });
/** What restoring the file would do. Nothing is written. */
export const previewRestore = (site, file, signal) => adminFetch(site, "/v1/import/restore", { method: "POST", form: formOf(file, "preview"), signal });
/** Restores the file into the empty site, in one transaction. */
export const runRestore = (site, file) => adminFetch(site, "/v1/import/restore", { method: "POST", form: formOf(file, "run") });
