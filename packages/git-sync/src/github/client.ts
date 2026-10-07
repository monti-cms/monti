/**
 * The part of GitHub git-sync talks to, as an interface. The sync code never calls `fetch`: it gets a client from a factory, so tests (and other hosts later)
 * bring their own. {@link createGitHubClient} (`rest.ts`) is the real one over the GitHub REST API; `@monti-cms/git-sync/testing` has an in-memory fake.
 *
 * Everything works on the git data API (blobs, trees, commits, refs): a publish never needs a checkout, which is what serverless hosting allows.
 */

/** The head of a branch. */
export interface BranchHead {
	readonly commitSha: string;
	readonly treeSha: string;
}

/** One change of a commit: a file with its new text, or a file to delete. Paths are repo-relative with `/`. */
export type FileChange =
	| { readonly path: string; readonly text: string; readonly delete?: undefined }
	| { readonly path: string; readonly delete: true; readonly text?: undefined };

export interface PullRequestRef {
	readonly number: number;
	readonly url: string;
	/** GraphQL node id (what enabling auto-merge needs). */
	readonly nodeId?: string;
}

export interface RepoInfo {
	readonly defaultBranch: string;
	/** Whether the repo lets pull requests merge themselves once checks pass (`allow_auto_merge`). */
	readonly allowAutoMerge: boolean;
}

export interface GitHubClient {
	getRepo(): Promise<RepoInfo>;
	/** The head of a branch, or `null` when the branch does not exist. */
	getBranchHead(branch: string): Promise<BranchHead | null>;
	/**
	 * The files under `folder` (`""` is the whole repo) at a commit's tree, recursively: repo-relative path to blob sha. Throws when GitHub says the listing was
	 * cut off (a tree too large to list), because a partial list would make files look deleted.
	 */
	listFiles(head: BranchHead, folder: string): Promise<Map<string, string>>;
	/** The text of a blob (UTF-8). */
	getBlob(sha: string): Promise<string>;
	/** Stores a text as a blob and returns its sha. */
	createBlob(text: string): Promise<string>;
	/** A new tree from `baseTree` with the entries applied: a sha puts that blob at the path, `null` removes the path. Returns the tree sha. */
	createTree(params: {
		readonly baseTree: string;
		readonly entries: readonly { readonly path: string; readonly sha: string | null }[];
	}): Promise<string>;
	createCommit(params: {
		readonly message: string;
		readonly tree: string;
		readonly parents: readonly string[];
	}): Promise<string>;
	/** Creates the branch at a commit. */
	createBranch(branch: string, commitSha: string): Promise<void>;
	/** Moves the branch to a commit. Without `force` it must be a fast-forward, otherwise GitHub refuses and this throws. */
	updateBranch(branch: string, commitSha: string, options?: { readonly force?: boolean }): Promise<void>;
	/** The open pull request from `head` into `base`, or `null`. */
	findOpenPullRequest(params: { readonly head: string; readonly base: string }): Promise<PullRequestRef | null>;
	createPullRequest(params: {
		readonly head: string;
		readonly base: string;
		readonly title: string;
		readonly body: string;
	}): Promise<PullRequestRef>;
	/** Turns on auto-merge (squash or merge, as the repo allows) for a pull request. Throws when GitHub refuses (no required checks, for instance). */
	enableAutoMerge(pullRequest: PullRequestRef): Promise<void>;
}

/** What a factory needs to make a client for one target. */
export interface GitHubClientOptions {
	readonly token: string;
	/** `owner/name`. */
	readonly repo: string;
	/** REST API root for GitHub Enterprise Server (`https://git.example.com/api/v3`). Default `https://api.github.com`. */
	readonly apiUrl?: string;
}

export type GitHubClientFactory = (options: GitHubClientOptions) => GitHubClient;

/** A failed GitHub call. `status` is the HTTP status (0 when GitHub could not be reached). */
export class GitHubApiError extends Error {
	readonly status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = "GitHubApiError";
		this.status = status;
	}
}
