import { type FileChange, type GitHubClient, type GitHubClientFactory } from "./github/client.js";
/**
 * Test helpers for sites that use git-sync (and for this package's own tests): a GitHub in memory, with the same client interface the plugin talks to, so a test
 * runs the whole flow (publish, commit, pull request, webhook, conflict) without the network. Hand its `factory` to `gitSync({ client: github.factory, ... })`.
 *
 * ```ts
 * const github = createFakeGitHub();
 * github.repo("acme/site", { main: { "content/hello.mdx": "..." } });
 * plugins: [gitSync({ client: github.factory, targets: [...] })]
 * ```
 */
type Tree = ReadonlyMap<string, string>;
interface Commit {
    readonly sha: string;
    readonly tree: string;
    readonly parents: readonly string[];
    readonly message: string;
}
export interface FakePullRequest {
    readonly number: number;
    readonly head: string;
    readonly base: string;
    title: string;
    body: string;
    state: "open" | "merged" | "closed";
    autoMerge: boolean;
}
/** A repo in memory. */
export declare class FakeRepo {
    readonly name: string;
    readonly blobs: Map<string, string>;
    readonly trees: Map<string, Tree>;
    readonly commits: Map<string, Commit>;
    readonly branches: Map<string, string>;
    readonly pullRequests: FakePullRequest[];
    allowAutoMerge: boolean;
    /** Set to make `enableAutoMerge` refuse (a repo with nothing to wait for). */
    autoMergeError: string | undefined;
    private counter;
    constructor(name: string);
    private id;
    addBlob(text: string): string;
    addTree(tree: Tree): string;
    addCommit(tree: string, parents: readonly string[], message: string): string;
    treeOf(branch: string): Tree;
    /** The files of a branch: path to text. */
    files(branch: string): Map<string, string>;
    /** A commit by someone else (an edit in git): the changes land on the branch, which is created from nothing when it does not exist. */
    commit(branch: string, changes: readonly FileChange[], message?: string): string;
    /** Whether `ancestor` is `descendant` or one of its ancestors. */
    isAncestor(ancestor: string, descendant: string): boolean;
    /** Closes an open pull request without merging it. */
    close(number: number): void;
    /**
     * Merges an open pull request the way GitHub's squash would: what the pull request branch changed since it left the base branch lands on the base as one commit.
     * Returns the new head of the base branch.
     */
    merge(number: number): string;
}
/** The GitHub in memory. */
export interface FakeGitHub {
    readonly factory: GitHubClientFactory;
    /** The calls the plugin made, in order (`"createBlob"`, `"updateBranch"`, ...). Clear it with `calls.length = 0`. */
    readonly calls: string[];
    /** The repo, created empty when it does not exist. Seed branches with `files`: `{ main: { "a.md": "text" } }`. */
    repo(name: string, files?: Readonly<Record<string, Readonly<Record<string, string>>>>): FakeRepo;
    /** The tokens the clients were made with. */
    readonly tokens: string[];
    /** Makes the next calls of a client method fail with a GitHub error (`times` calls, default 1). */
    failNext(method: keyof GitHubClient, options?: {
        readonly status?: number;
        readonly message?: string;
        readonly times?: number;
    }): void;
}
export declare function createFakeGitHub(): FakeGitHub;
/** The `X-Hub-Signature-256` header GitHub would send for this body. */
export declare const webhookSignature: (secret: string, rawBody: string) => string;
/** The body of a GitHub `push` event for a branch. */
export declare const pushPayload: (repo: string, branch: string) => string;
export {};
