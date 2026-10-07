import {
	type BranchHead,
	GitHubApiError,
	type GitHubClient,
	type GitHubClientFactory,
	type GitHubClientOptions,
	type PullRequestRef,
	type RepoInfo,
} from "./client";

const DEFAULT_API_URL = "https://api.github.com";

/** The fetch the client calls. Replaceable, so a test can check the requests without a network. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const encodeRef = (name: string) => name.split("/").map(encodeURIComponent).join("/");

/** The GraphQL endpoint that belongs to a REST root (`https://git.example.com/api/v3` to `https://git.example.com/api/graphql`). */
const graphqlUrl = (apiUrl: string) => `${apiUrl.replace(/\/v3\/?$/, "").replace(/\/$/, "")}/graphql`;

/**
 * The GitHub client over the REST API (and one GraphQL call for auto-merge). Every call that fails throws a {@link GitHubApiError} with the HTTP status, so the
 * event outbox retries it. The token is sent only in the `Authorization` header.
 */
export function createGitHubClient(options: GitHubClientOptions, fetchImpl: FetchLike = fetch): GitHubClient {
	const apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, "");
	const [owner, name] = options.repo.split("/");
	if (!owner || !name) throw new Error(`git-sync: "${options.repo}" is not an owner/name repo`);
	const repoUrl = `${apiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
	const headers = {
		Authorization: `Bearer ${options.token}`,
		Accept: "application/vnd.github+json",
		"Content-Type": "application/json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": "monti-cms-git-sync",
	};

	const send = async (url: string, init: { method: string; body?: unknown }): Promise<Response> => {
		try {
			return await fetchImpl(url, {
				method: init.method,
				headers,
				...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
			});
		} catch (error) {
			throw new GitHubApiError(
				`GitHub could not be reached: ${error instanceof Error ? error.message : String(error)}`,
				0,
			);
		}
	};

	const failure = async (response: Response): Promise<GitHubApiError> => {
		let detail = response.statusText;
		try {
			const body = (await response.json()) as { message?: unknown };
			if (typeof body.message === "string" && body.message) detail = body.message;
		} catch {
			// The body is not JSON: the status text stands.
		}
		return new GitHubApiError(`GitHub answered ${response.status}: ${detail}`, response.status);
	};

	/** A call that must succeed. */
	const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
		const response = await send(`${repoUrl}${path}`, { method, body });
		if (!response.ok) throw await failure(response);
		return (await response.json()) as T;
	};

	/** A call whose 404 means "there is none". */
	const callOrNull = async <T>(method: string, path: string): Promise<T | null> => {
		const response = await send(`${repoUrl}${path}`, { method });
		if (response.status === 404) return null;
		if (!response.ok) throw await failure(response);
		return (await response.json()) as T;
	};

	return {
		async getRepo(): Promise<RepoInfo> {
			const repo = await call<{ default_branch: string; allow_auto_merge?: boolean }>("GET", "");
			return { defaultBranch: repo.default_branch, allowAutoMerge: repo.allow_auto_merge === true };
		},

		async getBranchHead(branch): Promise<BranchHead | null> {
			const ref = await callOrNull<{ object: { sha: string } }>("GET", `/git/ref/heads/${encodeRef(branch)}`);
			if (!ref) return null;
			const commit = await call<{ tree: { sha: string } }>("GET", `/git/commits/${ref.object.sha}`);
			return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
		},

		async listFiles(head, folder) {
			const tree = await call<{ tree: { path: string; type: string; sha: string }[]; truncated?: boolean }>(
				"GET",
				`/git/trees/${head.treeSha}?recursive=1`,
			);
			if (tree.truncated) {
				throw new GitHubApiError(
					"GitHub cut the file list of the repo off (the repo is too large to list in one call)",
					0,
				);
			}
			const prefix = folder ? `${folder}/` : "";
			return new Map(
				tree.tree
					.filter((item) => item.type === "blob" && item.path.startsWith(prefix))
					.map((item) => [item.path, item.sha]),
			);
		},

		async getBlob(sha) {
			const blob = await call<{ content: string; encoding: string }>("GET", `/git/blobs/${sha}`);
			if (blob.encoding !== "base64") throw new GitHubApiError(`GitHub sent a blob in "${blob.encoding}" encoding`, 0);
			return Buffer.from(blob.content, "base64").toString("utf8");
		},

		async createBlob(text) {
			return (await call<{ sha: string }>("POST", "/git/blobs", { content: text, encoding: "utf-8" })).sha;
		},

		async createTree({ baseTree, entries }) {
			const tree = await call<{ sha: string }>("POST", "/git/trees", {
				base_tree: baseTree,
				tree: entries.map((entry) => ({ path: entry.path, mode: "100644", type: "blob", sha: entry.sha })),
			});
			return tree.sha;
		},

		async createCommit({ message, tree, parents }) {
			return (await call<{ sha: string }>("POST", "/git/commits", { message, tree, parents })).sha;
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
			const found = await call<{ number: number; html_url: string; node_id?: string }[]>(
				"GET",
				`/pulls?state=open&head=${encodeURIComponent(`${owner}:${head}`)}&base=${encodeURIComponent(base)}`,
			);
			const first = found[0];
			return first ? { number: first.number, url: first.html_url, nodeId: first.node_id } : null;
		},

		async createPullRequest({ head, base, title, body }) {
			const created = await call<{ number: number; html_url: string; node_id?: string }>("POST", "/pulls", {
				title,
				head,
				base,
				body,
			});
			return { number: created.number, url: created.html_url, nodeId: created.node_id };
		},

		async enableAutoMerge(pullRequest: PullRequestRef) {
			if (!pullRequest.nodeId)
				throw new GitHubApiError("The pull request has no GraphQL id, so auto-merge cannot be enabled", 0);
			const repo = await call<{
				allow_squash_merge?: boolean;
				allow_merge_commit?: boolean;
				allow_rebase_merge?: boolean;
			}>("GET", "");
			const mergeMethod = repo.allow_squash_merge !== false ? "SQUASH" : repo.allow_merge_commit ? "MERGE" : "REBASE";
			const response = await send(graphqlUrl(apiUrl), {
				method: "POST",
				body: {
					query:
						"mutation($id: ID!, $method: PullRequestMergeMethod!) { enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $method }) { clientMutationId } }",
					variables: { id: pullRequest.nodeId, method: mergeMethod },
				},
			});
			if (!response.ok) throw await failure(response);
			const result = (await response.json()) as { errors?: { message?: string }[] };
			if (result.errors?.length) {
				throw new GitHubApiError(`GitHub refused auto-merge: ${result.errors[0]?.message ?? "unknown reason"}`, 422);
			}
		},
	};
}

/** The real client as a factory (what the plugin uses unless `gitSync({ client })` gives another one). */
export const githubClientFactory: GitHubClientFactory = (options) => createGitHubClient(options);
