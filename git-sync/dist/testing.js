import { createHash, createHmac } from "node:crypto";
import { blobSha } from "./github/blob-sha.js";
import { GitHubApiError, } from "./github/client.js";
/** A repo in memory. */
export class FakeRepo {
    name;
    blobs = new Map();
    trees = new Map();
    commits = new Map();
    branches = new Map();
    pullRequests = [];
    allowAutoMerge = true;
    /** Set to make `enableAutoMerge` refuse (a repo with nothing to wait for). */
    autoMergeError;
    counter = 0;
    constructor(name) {
        this.name = name;
    }
    id(kind, ...parts) {
        this.counter += 1;
        return createHash("sha1")
            .update(`${kind}:${this.name}:${this.counter}:${parts.join("|")}`)
            .digest("hex");
    }
    addBlob(text) {
        const sha = blobSha(text);
        this.blobs.set(sha, text);
        return sha;
    }
    addTree(tree) {
        const sha = createHash("sha1")
            .update(JSON.stringify([...tree].sort()))
            .digest("hex");
        this.trees.set(sha, tree);
        return sha;
    }
    addCommit(tree, parents, message) {
        const sha = this.id("commit", tree, ...parents, message);
        this.commits.set(sha, { sha, tree, parents, message });
        return sha;
    }
    treeOf(branch) {
        const commit = this.commits.get(this.branches.get(branch) ?? "");
        return (commit && this.trees.get(commit.tree)) || new Map();
    }
    /** The files of a branch: path to text. */
    files(branch) {
        return new Map([...this.treeOf(branch)].map(([path, sha]) => [path, this.blobs.get(sha) ?? ""]));
    }
    /** A commit by someone else (an edit in git): the changes land on the branch, which is created from nothing when it does not exist. */
    commit(branch, changes, message = "Edit in git") {
        const tree = new Map(this.treeOf(branch));
        for (const change of changes) {
            if (change.delete)
                tree.delete(change.path);
            else
                tree.set(change.path, this.addBlob(change.text));
        }
        const parent = this.branches.get(branch);
        const sha = this.addCommit(this.addTree(tree), parent ? [parent] : [], message);
        this.branches.set(branch, sha);
        return sha;
    }
    /** Whether `ancestor` is `descendant` or one of its ancestors. */
    isAncestor(ancestor, descendant) {
        const seen = new Set();
        const stack = [descendant];
        while (stack.length > 0) {
            const sha = stack.pop() ?? "";
            if (sha === ancestor)
                return true;
            if (seen.has(sha))
                continue;
            seen.add(sha);
            stack.push(...(this.commits.get(sha)?.parents ?? []));
        }
        return false;
    }
    /** Closes an open pull request without merging it. */
    close(number) {
        const pr = this.pullRequests.find((item) => item.number === number);
        if (!pr || pr.state !== "open")
            throw new Error(`no open pull request #${number}`);
        pr.state = "closed";
    }
    /**
     * Merges an open pull request the way GitHub's squash would: what the pull request branch changed since it left the base branch lands on the base as one commit.
     * Returns the new head of the base branch.
     */
    merge(number) {
        const pr = this.pullRequests.find((item) => item.number === number);
        if (!pr || pr.state !== "open")
            throw new Error(`no open pull request #${number}`);
        const head = this.branches.get(pr.head) ?? "";
        const base = this.branches.get(pr.base) ?? "";
        // The merge base: the first commit on the way back from the head that the base branch also has.
        let mergeBase;
        const queue = [head];
        while (queue.length > 0 && !mergeBase) {
            const sha = queue.shift() ?? "";
            if (this.isAncestor(sha, base))
                mergeBase = sha;
            else
                queue.push(...(this.commits.get(sha)?.parents ?? []));
        }
        const before = (mergeBase && this.trees.get(this.commits.get(mergeBase)?.tree ?? "")) || new Map();
        const after = this.trees.get(this.commits.get(head)?.tree ?? "") ?? new Map();
        const merged = new Map(this.treeOf(pr.base));
        for (const [path, sha] of after)
            if (before.get(path) !== sha)
                merged.set(path, sha);
        for (const path of before.keys())
            if (!after.has(path))
                merged.delete(path);
        const sha = this.addCommit(this.addTree(merged), [base], `Merge #${number}: ${pr.title}`);
        this.branches.set(pr.base, sha);
        pr.state = "merged";
        return sha;
    }
}
export function createFakeGitHub() {
    const repos = new Map();
    const calls = [];
    const tokens = [];
    const failures = new Map();
    const repo = (name, files) => {
        let found = repos.get(name.toLowerCase());
        if (!found) {
            found = new FakeRepo(name);
            repos.set(name.toLowerCase(), found);
        }
        for (const [branch, entries] of Object.entries(files ?? {})) {
            found.commit(branch, Object.entries(entries).map(([path, text]) => ({ path, text })), "Seed");
        }
        return found;
    };
    const clientFor = (options) => {
        tokens.push(options.token);
        const target = repo(options.repo);
        const enter = (method) => {
            calls.push(method);
            const failure = failures.get(method);
            if (failure && failure.times > 0) {
                failure.times -= 1;
                throw new GitHubApiError(failure.message, failure.status);
            }
        };
        const head = (sha) => ({ commitSha: sha, treeSha: target.commits.get(sha)?.tree ?? "" });
        const toRef = (pr) => ({
            number: pr.number,
            url: `https://github.com/${target.name}/pull/${pr.number}`,
            nodeId: `PR_${pr.number}`,
        });
        return {
            async getRepo() {
                enter("getRepo");
                return { defaultBranch: "main", allowAutoMerge: target.allowAutoMerge };
            },
            async getBranchHead(branch) {
                enter("getBranchHead");
                const sha = target.branches.get(branch);
                return sha ? head(sha) : null;
            },
            async listFiles(at, folder) {
                enter("listFiles");
                const prefix = folder ? `${folder}/` : "";
                return new Map([...(target.trees.get(at.treeSha) ?? new Map())].filter(([path]) => path.startsWith(prefix)));
            },
            async getBlob(sha) {
                enter("getBlob");
                const text = target.blobs.get(sha);
                if (text === undefined)
                    throw new GitHubApiError("Not Found", 404);
                return text;
            },
            async createBlob(text) {
                enter("createBlob");
                return target.addBlob(text);
            },
            async createTree({ baseTree, entries }) {
                enter("createTree");
                const tree = new Map(target.trees.get(baseTree) ?? []);
                for (const entry of entries) {
                    if (entry.sha === null)
                        tree.delete(entry.path);
                    else
                        tree.set(entry.path, entry.sha);
                }
                return target.addTree(tree);
            },
            async createCommit({ message, tree, parents }) {
                enter("createCommit");
                return target.addCommit(tree, parents, message);
            },
            async createBranch(branch, commitSha) {
                enter("createBranch");
                if (target.branches.has(branch))
                    throw new GitHubApiError("Reference already exists", 422);
                target.branches.set(branch, commitSha);
            },
            async updateBranch(branch, commitSha, options) {
                enter("updateBranch");
                const current = target.branches.get(branch);
                if (!current)
                    throw new GitHubApiError("Reference does not exist", 422);
                if (!options?.force && !target.isAncestor(current, commitSha)) {
                    throw new GitHubApiError("Update is not a fast forward", 422);
                }
                target.branches.set(branch, commitSha);
            },
            async findOpenPullRequest({ head: from, base }) {
                enter("findOpenPullRequest");
                const found = target.pullRequests.find((pr) => pr.state === "open" && pr.head === from && pr.base === base);
                return found ? toRef(found) : null;
            },
            async createPullRequest({ head: from, base, title, body }) {
                enter("createPullRequest");
                const pr = {
                    number: target.pullRequests.length + 1,
                    head: from,
                    base,
                    title,
                    body,
                    state: "open",
                    autoMerge: false,
                };
                target.pullRequests.push(pr);
                return toRef(pr);
            },
            async enableAutoMerge(ref) {
                enter("enableAutoMerge");
                if (target.autoMergeError)
                    throw new GitHubApiError(target.autoMergeError, 422);
                const pr = target.pullRequests.find((item) => item.number === ref.number);
                if (pr)
                    pr.autoMerge = true;
            },
        };
    };
    return {
        factory: clientFor,
        calls,
        tokens,
        repo,
        failNext(method, options) {
            failures.set(method, {
                status: options?.status ?? 502,
                message: options?.message ?? `GitHub answered ${options?.status ?? 502}: simulated failure`,
                times: options?.times ?? 1,
            });
        },
    };
}
/** The `X-Hub-Signature-256` header GitHub would send for this body. */
export const webhookSignature = (secret, rawBody) => `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
/** The body of a GitHub `push` event for a branch. */
export const pushPayload = (repo, branch) => JSON.stringify({ ref: `refs/heads/${branch}`, repository: { full_name: repo }, commits: [] });
