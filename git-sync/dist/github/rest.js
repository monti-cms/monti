import { GitHubApiError, } from "./client.js";
const DEFAULT_API_URL = "https://api.github.com";
const encodeRef = (name) => name.split("/").map(encodeURIComponent).join("/");
/** The GraphQL endpoint that belongs to a REST root (`https://git.example.com/api/v3` to `https://git.example.com/api/graphql`). */
const graphqlUrl = (apiUrl) => `${apiUrl.replace(/\/v3\/?$/, "").replace(/\/$/, "")}/graphql`;
/**
 * The GitHub client over the REST API (and one GraphQL call for auto-merge). Every call that fails throws a {@link GitHubApiError} with the HTTP status, so the
 * event outbox retries it. The token is sent only in the `Authorization` header.
 */
export function createGitHubClient(options, fetchImpl = fetch) {
    const apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, "");
    const [owner, name] = options.repo.split("/");
    if (!owner || !name)
        throw new Error(`git-sync: "${options.repo}" is not an owner/name repo`);
    const repoUrl = `${apiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
    const headers = {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "monti-cms-git-sync",
    };
    const send = async (url, init) => {
        try {
            return await fetchImpl(url, {
                method: init.method,
                headers,
                ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
            });
        }
        catch (error) {
            throw new GitHubApiError(`GitHub could not be reached: ${error instanceof Error ? error.message : String(error)}`, 0);
        }
    };
    const failure = async (response) => {
        let detail = response.statusText;
        try {
            const body = (await response.json());
            if (typeof body.message === "string" && body.message)
                detail = body.message;
        }
        catch {
            // The body is not JSON: the status text stands.
        }
        const hint = response.status === 401
            ? " (the token is wrong, expired or revoked: save a new one on the Git sync screen)"
            : response.status === 403 || response.status === 404
                ? " (the repo name may be wrong, or the token cannot see the repo or lacks Contents read and write: check both)"
                : "";
        return new GitHubApiError(`GitHub answered ${response.status}: ${detail}${hint}`, response.status);
    };
    /** A call that must succeed. */
    const call = async (method, path, body) => {
        const response = await send(`${repoUrl}${path}`, { method, body });
        if (!response.ok)
            throw await failure(response);
        return (await response.json());
    };
    /** A call whose 404 means "there is none". */
    const callOrNull = async (method, path) => {
        const response = await send(`${repoUrl}${path}`, { method });
        if (response.status === 404)
            return null;
        if (!response.ok)
            throw await failure(response);
        return (await response.json());
    };
    return {
        async getRepo() {
            const repo = await call("GET", "");
            return { defaultBranch: repo.default_branch, allowAutoMerge: repo.allow_auto_merge === true };
        },
        async getBranchHead(branch) {
            const ref = await callOrNull("GET", `/git/ref/heads/${encodeRef(branch)}`);
            if (!ref)
                return null;
            const commit = await call("GET", `/git/commits/${ref.object.sha}`);
            return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
        },
        async listFiles(head, folder) {
            const tree = await call("GET", `/git/trees/${head.treeSha}?recursive=1`);
            if (tree.truncated) {
                throw new GitHubApiError("GitHub cut the file list of the repo off (the repo is too large to list in one call)", 0);
            }
            const prefix = folder ? `${folder}/` : "";
            return new Map(tree.tree
                .filter((item) => item.type === "blob" && item.path.startsWith(prefix))
                .map((item) => [item.path, item.sha]));
        },
        async getBlob(sha) {
            const blob = await call("GET", `/git/blobs/${sha}`);
            if (blob.encoding !== "base64")
                throw new GitHubApiError(`GitHub sent a blob in "${blob.encoding}" encoding`, 0);
            return Buffer.from(blob.content, "base64").toString("utf8");
        },
        async createBlob(text) {
            return (await call("POST", "/git/blobs", { content: text, encoding: "utf-8" })).sha;
        },
        async createTree({ baseTree, entries }) {
            const tree = await call("POST", "/git/trees", {
                base_tree: baseTree,
                tree: entries.map((entry) => ({ path: entry.path, mode: "100644", type: "blob", sha: entry.sha })),
            });
            return tree.sha;
        },
        async createCommit({ message, tree, parents }) {
            return (await call("POST", "/git/commits", { message, tree, parents })).sha;
        },
        async createBranch(branch, commitSha) {
            await call("POST", "/git/refs", { ref: `refs/heads/${branch}`, sha: commitSha });
        },
        async updateBranch(branch, commitSha, updateOptions) {
            await call("PATCH", `/git/refs/heads/${encodeRef(branch)}`, {
                sha: commitSha,
                force: updateOptions?.force === true,
            });
        },
        async findOpenPullRequest({ head, base }) {
            const found = await call("GET", `/pulls?state=open&head=${encodeURIComponent(`${owner}:${head}`)}&base=${encodeURIComponent(base)}`);
            const first = found[0];
            return first ? { number: first.number, url: first.html_url, nodeId: first.node_id } : null;
        },
        async createPullRequest({ head, base, title, body }) {
            const created = await call("POST", "/pulls", {
                title,
                head,
                base,
                body,
            });
            return { number: created.number, url: created.html_url, nodeId: created.node_id };
        },
        async enableAutoMerge(pullRequest) {
            if (!pullRequest.nodeId)
                throw new GitHubApiError("The pull request has no GraphQL id, so auto-merge cannot be enabled", 0);
            const repo = await call("GET", "");
            const mergeMethod = repo.allow_squash_merge !== false ? "SQUASH" : repo.allow_merge_commit ? "MERGE" : "REBASE";
            const response = await send(graphqlUrl(apiUrl), {
                method: "POST",
                body: {
                    query: "mutation($id: ID!, $method: PullRequestMergeMethod!) { enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $method }) { clientMutationId } }",
                    variables: { id: pullRequest.nodeId, method: mergeMethod },
                },
            });
            if (!response.ok)
                throw await failure(response);
            const result = (await response.json());
            if (result.errors?.length) {
                throw new GitHubApiError(`GitHub refused auto-merge: ${result.errors[0]?.message ?? "unknown reason"}`, 422);
            }
        },
    };
}
/** The real client as a factory (what the plugin uses unless `gitSync({ client })` gives another one). */
export const githubClientFactory = (options) => createGitHubClient(options);
