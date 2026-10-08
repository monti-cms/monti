import { createContentService } from "./content-service.js";
import { ServiceError } from "./types.js";
import { createWritePipeline, linkResolverOf } from "./write-pipeline.js";
export const BULK_OPS = [
    "relation.add",
    "relation.remove",
    "relation.set",
    "folder.move",
    "archive",
    "unarchive",
    "trash",
    "publish",
    "permanentDelete",
];
const LIFECYCLE_OPS = ["archive", "unarchive", "trash", "publish"];
const RELATION_LIST_OPS = ["relation.add", "relation.remove"];
const MAX_ITEMS = 100;
const toServiceInput = (working, metadata) => ({ collection: working.collection, slug: working.slug, metadata, doc: working.doc });
/**
 * Bulk operations. Every item runs the same write pipeline as a single write (hooks included): a publish is the single publish, a relation or folder
 * change is a save. Results and errors are per item.
 */
export const createBulkService = (storePort, options) => {
    const { site } = options;
    const pipeline = options.pipeline ??
        createWritePipeline({
            hooks: options.hooks,
            formats: options.formats,
            media: options.media,
            site,
            links: linkResolverOf(site, storePort),
        });
    const content = createContentService(storePort, { site, pipeline });
    return {
        run: async (request) => {
            if (!request || typeof request !== "object" || !BULK_OPS.includes(request.op)) {
                throw new ServiceError("unknown_op");
            }
            if (!Array.isArray(request.items))
                throw new ServiceError("invalid_input");
            if (request.items.length > MAX_ITEMS)
                throw new ServiceError("too_many_items");
            if (request.op.startsWith("relation.") && typeof request.field !== "string")
                throw new ServiceError("invalid_input");
            if (RELATION_LIST_OPS.includes(request.op) && !Array.isArray(request.ids))
                throw new ServiceError("invalid_input");
            if (request.op === "relation.set" && request.id === undefined)
                throw new ServiceError("invalid_input");
            if (request.op === "folder.move" && request.folderId === undefined)
                throw new ServiceError("invalid_input");
            const results = [];
            for (const item of request.items) {
                if (!item || typeof item.id !== "string" || !item.id) {
                    results.push({ id: "", ok: false, error: "invalid_input" });
                    continue;
                }
                if (typeof item.expectedVersion !== "number" ||
                    !Number.isInteger(item.expectedVersion) ||
                    item.expectedVersion <= 0) {
                    results.push({ id: item.id, ok: false, error: "invalid_input" });
                    continue;
                }
                try {
                    if (request.op === "permanentDelete") {
                        // The store checks whether it is in the trash and whether it is referenced.
                        try {
                            await storePort.permanentDeleteEntry({ id: item.id, expectedVersion: item.expectedVersion });
                        }
                        catch (error) {
                            // The source deleted earlier in the same request also deleted its translations. An item that is already gone counts as deleted.
                            if (error?.code !== "not_found")
                                throw error;
                        }
                        // A deleted item has no new version. Returns the requested version as is.
                        results.push({ id: item.id, ok: true, version: item.expectedVersion });
                        continue;
                    }
                    if (request.op === "publish") {
                        const { entry, warnings } = await content.publish({ id: item.id, expectedVersion: item.expectedVersion });
                        results.push({
                            id: item.id,
                            ok: true,
                            version: entry.version,
                            ...(warnings.length > 0 ? { warnings } : {}),
                        });
                        continue;
                    }
                    if (LIFECYCLE_OPS.includes(request.op)) {
                        const lifecycleParams = { id: item.id, expectedVersion: item.expectedVersion };
                        const acted = request.op === "archive"
                            ? await storePort.archiveEntry(lifecycleParams)
                            : request.op === "unarchive"
                                ? await storePort.unarchiveEntry(lifecycleParams)
                                : await storePort.trashEntry(lifecycleParams);
                        results.push({ id: item.id, ok: true, version: acted.version });
                        continue;
                    }
                    const working = await storePort.getWorking({ entryId: item.id });
                    const metadata = { ...working.metadata };
                    let folderId;
                    if (request.op.startsWith("relation.")) {
                        const field = request.field ?? "";
                        // Changes only this collection's relation fields. Add and remove are for multi-value relations, set is for single-value ones.
                        const relation = site.storedField(working.collection, field)?.field;
                        const many = request.op !== "relation.set";
                        if (relation?.kind !== "relation" || (relation.many === true) !== many) {
                            throw new ServiceError("invalid_input");
                        }
                        if (many) {
                            // A relation with no values has no key at all (the editor removes empty arrays).
                            const value = metadata[field];
                            const current = Array.isArray(value) ? value.filter((t) => typeof t === "string") : [];
                            const ids = request.ids ?? [];
                            const next = request.op === "relation.add"
                                ? [...current, ...ids.filter((t) => typeof t === "string" && !current.includes(t))]
                                : current.filter((t) => !ids.includes(t));
                            if (next.length > 0)
                                metadata[field] = next;
                            else
                                delete metadata[field];
                        }
                        else if (request.id === null || request.id === undefined) {
                            delete metadata[field];
                        }
                        else {
                            metadata[field] = request.id;
                        }
                    }
                    else {
                        folderId = request.folderId ?? null;
                    }
                    const previousReferences = await storePort.getWorkingReferences({ entryId: item.id });
                    // A metadata or folder change leaves the body as it is, block ids included.
                    const { snapshot, warnings } = await pipeline.run({
                        operation: "save",
                        entryId: item.id,
                        locale: working.locale ?? site.DEFAULT_LOCALE,
                        input: toServiceInput(working, metadata),
                        prepare: { previousReferences, previousDoc: working.doc, previousMetadata: working.metadata },
                    });
                    const saved = (await storePort.saveWorkingWithReferences({
                        entryId: item.id,
                        expectedVersion: item.expectedVersion,
                        snapshot,
                        references: snapshot.references,
                        folderId,
                    }));
                    results.push({ id: item.id, ok: true, version: saved.version, ...(warnings.length > 0 ? { warnings } : {}) });
                }
                catch (e) {
                    const { code, issues, details } = (e ?? {});
                    const usages = details?.usages;
                    results.push({
                        id: item.id,
                        ok: false,
                        error: typeof code === "string" ? code : "internal",
                        ...(Array.isArray(issues) && issues.length > 0 ? { issues } : {}),
                        ...(Array.isArray(usages) && usages.length > 0 ? { usages } : {}),
                    });
                }
            }
            return { results };
        },
    };
};
