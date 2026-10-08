import { prepareSnapshot } from "../core/snapshot.js";
import { ServiceError } from "../core/types.js";
import { diffSchema } from "./diff.js";
import { applyTransforms, checkTransforms, transformCollections } from "./transforms.js";
/**
 * Planning and applying a schema change: `planSchemaChange` is read-only and says what `applySchemaChange` would do; `applySchemaChange` runs the pending
 * transforms and records the schema and its version. The command line (`monti schema:diff`, `monti schema:apply`) and the settings screen are both thin
 * layers over these.
 *
 * The old side of a diff is the schema last applied to the store (`SchemaChangeStore.readSchemaState`), the new side is the site's. A store that never applied
 * one is at its baseline: nothing differs, the first apply records the schema and the version without touching an entry (so a site that extracted its
 * schema file (`monti schema:extract`) and applies it with no transforms changes nothing).
 */
/** The data model of a site as JSON: what is recorded as "applied" and what the next diff reads as the old side. */
export function snapshotSchema(site) {
    const { collections, locales, defaultLocale } = site.config;
    return JSON.parse(JSON.stringify({ collections, locales, defaultLocale }, (_key, value) => typeof value === "function" ? undefined : value));
}
/** The version of the schema of a site: its `schemaVersion`, 1 if unset. */
export const schemaVersionOf = (site) => site.config.schemaVersion ?? 1;
/**
 * Compares the site's schema with the one last applied, and finds the transforms still to run. Read-only.
 *
 * Versions: `nextVersion` is the file's version, raised to one above the applied version when something changes. A schema file that was already raised (by
 * `schema:apply` on a development machine, then committed) is left alone, so the production run records the same version and writes nothing to the file.
 */
export async function planSchemaChange(options) {
    const { site, store } = options;
    const migrations = options.migrations ?? [];
    const applied = await store.readSchemaState();
    const alreadyApplied = await store.appliedSchemaTransforms(migrations.map((item) => item.id));
    const done = new Set(alreadyApplied);
    const pending = migrations.filter((item) => !done.has(item.id));
    const problems = checkTransforms(site, pending);
    const current = site.config;
    const diff = applied
        ? diffSchema(applied.schema, current, { transforms: pending })
        : { changes: [], renameHints: [] };
    const changed = diff.changes.length > 0 || pending.length > 0;
    const fileVersion = schemaVersionOf(site);
    const nextVersion = applied
        ? changed
            ? Math.max(fileVersion, applied.schemaVersion + 1)
            : Math.max(fileVersion, applied.schemaVersion)
        : fileVersion;
    return {
        applied,
        diff,
        pending,
        alreadyApplied,
        problems,
        nextVersion,
        needsVersionBump: nextVersion !== fileVersion,
        changed,
    };
}
/** The transforms cannot run: a transform does not fit the schema, or an entry cannot be rewritten. Nothing was changed. */
export class SchemaChangeError extends Error {
    problems;
    constructor(message, problems = []) {
        super(message);
        this.name = "SchemaChangeError";
        this.problems = problems;
    }
}
/**
 * Applies the schema: runs the transforms that did not run yet, and records the schema and its version. Idempotent: each transform is recorded in
 * `cms_migrations` (like `storage.once`), so a second run runs none of them, and with the schema unchanged it only records the same schema again.
 *
 * Every transform goes through the write rules (`prepareSnapshot`, with no write hooks): the changed metadata is checked, and the content hash, the search text and
 * the metadata references are recomputed from it, so they cannot drift from the data. Working and published bodies are rewritten the same way and `version` and
 * `updated_at` of the entry and its bodies are kept, as in the data migrations before, so an entry that had unpublished changes still has them and one that did
 * not still does not. A transformed body is stamped with the new schema version. Nothing is dropped without a `dropField` transform.
 *
 * Throws a {@link SchemaChangeError} (changing nothing) when a transform does not fit the schema or an entry cannot be rewritten.
 */
export async function applySchemaChange(options) {
    const { site, store } = options;
    const plan = await planSchemaChange(options);
    if (plan.problems.length > 0) {
        throw new SchemaChangeError(`cannot apply: ${plan.problems.map((problem) => `${problem.id}: ${problem.message}`).join("; ")}`, plan.problems);
    }
    const schemaVersion = options.schemaVersion ?? plan.nextVersion;
    const conflicts = [];
    const result = await store.applySchemaChange({
        transformIds: (options.migrations ?? []).map((item) => item.id),
        collections: transformCollections(plan.pending),
        schema: snapshotSchema(site),
        schemaVersion,
        dryRun: options.dryRun,
        rewrite: async (body, pending) => {
            const transforms = plan.pending.filter((item) => pending.includes(item.id));
            const outcome = applyTransforms(site, transforms, body, body.metadata);
            for (const conflict of outcome.conflicts)
                conflicts.push({ ...conflict, entryId: body.entryId });
            if (outcome.changedBy.length === 0)
                return null;
            let snapshot;
            try {
                snapshot = await prepareSnapshot(site, { collection: body.collection, slug: null, metadata: outcome.metadata, doc: body.doc }, { schemaVersion, previousMetadata: body.metadata, previousDoc: body.doc });
            }
            catch (error) {
                const code = error instanceof ServiceError ? error.code : error instanceof Error ? error.message : String(error);
                throw new SchemaChangeError(`entry ${body.entryId} (${body.collection}, ${body.state}) cannot be rewritten by ${outcome.changedBy.join(", ")}: ${code}`);
            }
            return {
                metadata: snapshot.metadata,
                doc: snapshot.doc,
                contentHash: snapshot.contentHash,
                references: snapshot.references.flatMap((ref) => {
                    const occurrences = ref.occurrences.filter((occurrence) => occurrence.type === "metadata");
                    return occurrences.length === 0 ? [] : [{ kind: ref.kind, targetId: ref.targetId, occurrences }];
                }),
                changedBy: outcome.changedBy,
            };
        },
    });
    return { plan, result, schemaVersion, conflicts };
}
