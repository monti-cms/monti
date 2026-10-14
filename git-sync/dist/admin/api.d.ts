import { type Site } from "@monti-cms/core/client";
/** The shapes of the plugin's API responses, as the screen reads them (dates arrive as ISO strings). */
export interface PullSummaryView {
    at: string;
    head: string;
    applied: number;
    created: number;
    unchanged: number;
    conflicts: number;
    skipped: {
        path: string;
        reason: string;
    }[];
    errors: {
        path: string;
        message: string;
    }[];
}
export interface TargetView {
    id: string;
    repo: string;
    branch: string;
    folder: string;
    format: string;
    path: string;
    mode: "commit" | "pr";
    prBranch: string;
    collections: string[];
    synced: number;
    queued: number;
    conflicts: number;
    lastPull?: PullSummaryView;
    lastFlush?: {
        at: string;
        files: number;
        commitSha: string;
        branch: string;
        pullRequestUrl?: string;
        note?: string;
    };
}
export interface SlotKeyView {
    id: string;
    name: string;
    tail: string;
    readable: boolean;
}
export interface StatusView {
    keys: {
        secretsAvailable: boolean;
        token: SlotKeyView | null;
        webhookSecret: SlotKeyView | null;
    };
    targets: TargetView[];
}
export interface ConflictView {
    id: string;
    target: string;
    repo: string;
    entryId: string;
    collection: string;
    locale: string;
    path: string;
    kind: "changed" | "removed";
    reason: "both-changed" | "unpublished-changes" | "unsynced" | "git-edit-blocks-removal";
    detectedAt: string;
    label: string;
    serverText: string | null;
    gitText: string;
    gitSha: string;
}
export type ResolveChoice = "git" | "server";
export type KeySlot = "token" | "webhook-secret";
export declare const gitSyncKeys: {
    all: readonly ["cms", "git-sync"];
    status: () => readonly ["cms", "git-sync", "status"];
    conflicts: () => readonly ["cms", "git-sync", "conflicts"];
};
export interface GitSyncRequestOptions {
    signal?: AbortSignal;
    fallback?: string;
}
/** `GET /v1/git-sync/status` */
export declare const getGitSyncStatus: (site: Site, options?: GitSyncRequestOptions) => Promise<StatusView>;
/** `GET /v1/git-sync/conflicts` */
export declare const listGitSyncConflicts: (site: Site, options?: GitSyncRequestOptions) => Promise<{
    items: ConflictView[];
}>;
/** `POST /v1/git-sync/pull` */
export declare const pullGitSync: (site: Site, target: string, fallback?: string) => Promise<{
    results: {
        target: string;
        summary: PullSummaryView;
    }[];
}>;
/** `POST /v1/git-sync/flush` */
export declare const flushGitSync: (site: Site, target: string, fallback?: string) => Promise<{
    results: {
        written: number;
        removed: number;
    }[];
}>;
/** `POST /v1/git-sync/conflicts/resolve` */
export declare const resolveGitSyncConflict: (site: Site, conflict: ConflictView, resolution: ResolveChoice, fallback?: string) => Promise<unknown>;
/** `PUT /v1/api-keys/slots`: assigns an API key to one of the plugin's slots. */
export declare const assignGitSyncKey: (site: Site, values: {
    slot: KeySlot;
    key: unknown;
}, fallback?: string) => Promise<unknown>;
