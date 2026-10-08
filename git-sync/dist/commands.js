import { pullTarget } from "./inbound.js";
import { flushTarget, pushAll } from "./outbound.js";
import { syncContextFor } from "./sync.js";
/**
 * `monti git-sync:<command>`: the plugin's command line. They load the app like `monti migrate` (`.env.local`, `cms.server.ts`), so the token and the
 * instance's secrets are the app's own.
 */
const targetOption = { type: "string", description: "Only this target (its id); default: every target" };
/** The targets a command works on: the one named by `--target`, or all. */
const pick = (targets, wanted) => {
    if (typeof wanted !== "string")
        return targets;
    const found = targets.find((target) => target.id === wanted);
    if (!found)
        throw new Error(`There is no git-sync target "${wanted}" (targets: ${targets.map((target) => target.id).join(", ") || "none"})`);
    return [found];
};
export const commands = {
    pull: {
        description: 'Read the files that changed in the repo and apply them to the CMS (what the push webhook and "Pull now" do)',
        options: { target: targetOption },
        run: async ({ cms, args, log }) => {
            const ctx = syncContextFor(cms);
            let conflicts = 0;
            let errors = 0;
            for (const target of pick(ctx.targets, args.target)) {
                const summary = await pullTarget(ctx, target);
                log(`${target.id} (${target.repo}@${target.branch}): ${summary.created} created, ${summary.applied} updated, ${summary.unchanged} unchanged, ${summary.conflicts} conflicts, ${summary.errors.length} errors`);
                for (const item of summary.errors)
                    log(`  error  ${item.path}: ${item.message}`);
                for (const item of summary.skipped)
                    log(`  skipped  ${item.path}: ${item.reason}`);
                conflicts += summary.conflicts;
                errors += summary.errors.length;
            }
            if (conflicts > 0)
                log(`${conflicts} conflicts wait for a decision on the Git sync screen`);
            return errors > 0 ? 1 : 0;
        },
    },
    push: {
        description: "Commit every published entry of the targets to the repo (the first sync). Needs --all",
        options: { all: { type: "boolean", description: "Export every published entry (required)" }, target: targetOption },
        run: async ({ cms, args, log, error }) => {
            if (args.all !== true) {
                error("git-sync:push needs --all: it exports every published entry of the targets to the repo");
                return 1;
            }
            const ctx = syncContextFor(cms);
            for (const target of pick(ctx.targets, args.target)) {
                const result = await pushAll(ctx, target);
                log(`${target.id} (${target.repo}@${target.branch}): ${result.queued} published entries, ${result.written} files written, ${result.removed} removed, ${result.conflicts} conflicts${result.commitSha ? `, commit ${result.commitSha.slice(0, 7)} on ${result.branch}` : ", nothing to commit"}`);
                if (result.pullRequestUrl)
                    log(`  pull request: ${result.pullRequestUrl}`);
            }
            return 0;
        },
    },
    flush: {
        description: "Commit the publishes that are waiting in the batch queue now, without waiting for the batch window",
        options: { target: targetOption },
        run: async ({ cms, args, log }) => {
            const ctx = syncContextFor(cms);
            for (const target of pick(ctx.targets, args.target)) {
                const result = await flushTarget(ctx, target);
                log(`${target.id}: ${result.written} written, ${result.removed} removed${result.commitSha ? `, commit ${result.commitSha.slice(0, 7)}` : ", nothing to commit"}`);
            }
            return 0;
        },
    },
};
