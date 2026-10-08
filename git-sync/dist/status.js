import { settingsView } from "./settings.js";
export async function statusView(ctx) {
    const targets = [];
    for (const target of ctx.targets) {
        const [records, queue, conflicts, status] = await Promise.all([
            ctx.state.records.list(target.id),
            ctx.state.queue.list(target.id),
            ctx.state.conflicts.list(target.id),
            ctx.state.status.get(target.id),
        ]);
        targets.push({
            id: target.id,
            repo: target.repo,
            branch: target.branch,
            folder: target.folder,
            format: target.format,
            path: target.path,
            mode: target.mode,
            prBranch: target.prBranch,
            collections: target.collections,
            synced: [...records.values()].filter((record) => record.blobSha !== null).length,
            queued: queue.length,
            conflicts: conflicts.length,
            ...(status.lastPull ? { lastPull: status.lastPull } : {}),
            ...(status.lastFlush ? { lastFlush: status.lastFlush } : {}),
        });
    }
    return { settings: await settingsView(ctx), targets };
}
