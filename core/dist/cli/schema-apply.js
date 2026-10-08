import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applySchemaChange, checkSchemaChange, describeSchemaChange, planSchemaChange, } from "../schema-change/index.js";
import { loadApp } from "./app.js";
import { findSchemaFile, readSchema } from "./schema-types.js";
/** What the apply does to entries that a change touches, in words. */
const CONSEQUENCE = {
    none: "",
    transformed: "rewritten by its transform",
    deleted: "stored values DELETED by the dropField transform",
    orphaned: "values kept as orphans (hidden from the public read; publishing warns)",
    unknown_value: "values kept as stored; publishing warns (unknown_select_value)",
    publish_blocked: "cannot be published until the field is filled",
    warned: "content kept; every save and publish warns",
    invalid_values: "stored values may not fit the new type; saving may be rejected",
    kept: "data kept as it is",
};
const quote = (title, id) => (title ? `"${title}"` : id.slice(0, 8));
function formatImpact(item) {
    const text = describeSchemaChange(item.change);
    const via = item.change.handledBy ? ` [transform ${item.change.handledBy}]` : "";
    if (!item.checked)
        return `  - ${text}${via} (not checked against stored entries)`;
    if (item.entries === 0)
        return `  - ${text}${via}`;
    const sample = item.sample.map((entry) => quote(entry.title, entry.id)).join(", ");
    const more = item.entries > item.sample.length ? ", ..." : "";
    const effect = CONSEQUENCE[item.consequence];
    return `  - ${text}${via}: ${item.entries} ${item.entries === 1 ? "entry" : "entries"} (${sample}${more})${effect ? `; ${effect}` : ""}`;
}
/** The text `schema:diff` and `schema:apply` print for a plan and its impact. */
export function formatSchemaPlan(plan, impact) {
    const lines = [];
    if (!plan.applied) {
        lines.push("No schema has been applied to this store yet: the first `monti schema:apply` records the current schema as the baseline and changes no entry.");
    }
    else {
        lines.push(`Applied schema version: ${plan.applied.schemaVersion}. After the apply: ${plan.nextVersion}.`);
    }
    if (plan.applied) {
        lines.push(plan.diff.changes.length === 0
            ? "No change to collections, fields, options, locales or allowed blocks."
            : `Changes (${plan.diff.changes.length}):`);
        lines.push(...impact.impacts.map(formatImpact));
        for (const hint of plan.diff.renameHints) {
            const where = hint.scope === "field" ? `${hint.collection}.` : "";
            lines.push(`  hint: ${where}${hint.from} -> ${where}${hint.to} looks like a rename; without a renameField transform the values of "${hint.from}" stay as orphans`);
        }
    }
    if (plan.pending.length > 0) {
        lines.push(`Transforms to run (${plan.pending.length}): ${plan.pending.map((item) => item.id).join(", ")}`);
    }
    for (const problem of plan.problems)
        lines.push(`  PROBLEM ${problem.id}: ${problem.message}`);
    return lines.join("\n");
}
/** The text for a finished (or dry) apply. */
export function formatApplyResult(done, wroteVersion, schemaFile) {
    const { result } = done;
    const lines = [];
    if (result.applied.length === 0) {
        lines.push(`No transform to run. Recorded the schema at version ${done.schemaVersion}.`);
    }
    else {
        for (const id of result.applied) {
            const count = result.changed[id];
            lines.push(`Ran ${id}: ${count?.entries ?? 0} entries (${count?.bodies ?? 0} stored bodies) changed.`);
        }
        lines.push(`Recorded the schema at version ${done.schemaVersion} (${result.entries} entries rewritten).`);
    }
    if (result.skipped.length > 0)
        lines.push(`Already applied before: ${result.skipped.join(", ")}.`);
    for (const conflict of done.conflicts) {
        lines.push(`WARNING ${conflict.id}: entry ${conflict.entryId} has a value under "${conflict.to}" already; "${conflict.from}" was kept next to it (nothing was overwritten).`);
    }
    if (wroteVersion)
        lines.push(`Raised schemaVersion in ${schemaFile} to ${done.schemaVersion}; commit it.`);
    if (result.dryRun)
        lines.push("Dry run: nothing was changed.");
    return lines.join("\n");
}
/**
 * Sets `schemaVersion` in the text of a schema file without reformatting it: the existing number is replaced; a file without one gets the line after `$schema` (or
 * first). Works on the text so the file's own formatting stays.
 */
export function withSchemaVersion(text, version) {
    const present = /("schemaVersion"\s*:\s*)\d+/;
    if (present.test(text))
        return text.replace(present, `$1${version}`);
    const lines = text.split("\n");
    const open = lines.findIndex((line) => line.trim().startsWith("{"));
    if (open === -1)
        throw new Error("the schema file is not a JSON object");
    const next = lines.find((line, index) => index > open && line.trim() !== "") ?? "";
    const indent = /^\s*/.exec(next)?.[0] || "\t";
    const link = lines.findIndex((line, index) => index > open && /^\s*"\$schema"\s*:/.test(line));
    const at = link === -1 ? open + 1 : link + 1;
    lines.splice(at, 0, `${indent}"schemaVersion": ${version},`);
    return lines.join("\n");
}
async function load(options) {
    const file = findSchemaFile(options.cwd, options.schema);
    const schema = readSchema(options.cwd, file);
    const cms = await (options.loadCms ?? loadApp)(options);
    return { cms, file, migrations: schema.migrations ?? [] };
}
/** The store is not migrated to the step that records the applied schema. */
const MIGRATE_HINT = "the store has no schema record yet; run `monti migrate` first";
const isMissingTable = (error) => error?.code === "42P01";
/**
 * `monti schema:diff`: compares the schema of the site with the one last applied to the store (the snapshot `schema:apply` recorded), and says which stored entries
 * each change touches. Read-only. With `check`, exits 1 when there is anything to apply.
 */
export async function schemaDiff(options) {
    const { cms, migrations } = await load(options);
    try {
        const store = cms.store();
        const plan = await planSchemaChange({ site: cms.site, store, migrations });
        const impact = await checkSchemaChange(store, plan.diff, { site: cms.site, transforms: plan.pending });
        const exitCode = plan.problems.length > 0 || (options.check && plan.changed) ? 1 : 0;
        return { text: formatSchemaPlan(plan, impact), plan, impact, exitCode };
    }
    finally {
        await cms.close();
    }
}
/**
 * `monti schema:apply [--dry-run]`: migrates the store, runs the transforms of the schema file that did not run yet (`migrations`), and records the schema and its
 * version. It raises `schemaVersion` in the schema file when the schema changed and the file still has the old one (commit the file). Running it again does
 * nothing more. `dryRun` does everything inside a transaction that is rolled back, and writes nothing, not even the file.
 */
export async function schemaApply(options) {
    const { cms, file, migrations } = await load(options);
    try {
        // The migration runs first, as the command says; its lines head the output so the tables it touched are not changed silently.
        const migrated = [];
        if (!options.dryRun)
            await cms.migrate({ log: (line) => migrated.push(line) });
        const head = migrated.length > 0 ? `${migrated.join("\n")}\n\n` : "";
        const store = cms.store();
        const plan = await planSchemaChange({ site: cms.site, store, migrations });
        const impact = await checkSchemaChange(store, plan.diff, { site: cms.site, transforms: plan.pending });
        const preview = formatSchemaPlan(plan, impact);
        if (plan.problems.length > 0)
            return { text: `${head}${preview}\nNothing was applied.`, ok: false };
        let done;
        try {
            done = await applySchemaChange({ site: cms.site, store, migrations, dryRun: options.dryRun });
        }
        catch (error) {
            if (isMissingTable(error))
                return { text: `${head}${preview}\n${MIGRATE_HINT}`, ok: false };
            throw error;
        }
        let wroteVersion = false;
        if (!options.dryRun && plan.needsVersionBump) {
            const target = path.resolve(options.cwd, file);
            writeFileSync(target, withSchemaVersion(readFileSync(target, "utf8"), done.schemaVersion));
            wroteVersion = true;
        }
        return { text: `${head}${preview}\n${formatApplyResult(done, wroteVersion, file)}`, ok: true, done };
    }
    finally {
        await cms.close();
    }
}
