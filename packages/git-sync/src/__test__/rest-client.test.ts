import { describe, expect, it } from "vitest";
import { blobSha } from "../github/blob-sha";
import { GitHubApiError } from "../github/client";
import { createGitHubClient, type FetchLike } from "../github/rest";
import { webhookSignature } from "../testing";
import { verifySignature } from "../webhook";

/** A GitHub that answers from a table (`"GET /repos/acme/site"` to a body) and records the requests. */
function fakeFetch(answers: Record<string, unknown | { status: number; body?: unknown }>) {
	const requests: { method: string; url: string; headers: Record<string, string>; body?: unknown }[] = [];
	const fetchImpl: FetchLike = async (url, init) => {
		const method = init.method ?? "GET";
		const path = url.replace("https://api.github.com", "");
		requests.push({
			method,
			url,
			headers: init.headers as Record<string, string>,
			...(init.body ? { body: JSON.parse(String(init.body)) } : {}),
		});
		const answer = answers[`${method} ${path}`];
		if (answer === undefined) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
		if (typeof answer === "object" && answer !== null && "status" in answer) {
			const { status, body } = answer as { status: number; body?: unknown };
			return new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status });
		}
		return new Response(JSON.stringify(answer), { status: 200 });
	};
	return { fetchImpl, requests };
}

const client = (answers: Record<string, unknown>) => {
	const { fetchImpl, requests } = fakeFetch(answers);
	return { requests, github: createGitHubClient({ token: "ghp_secret", repo: "acme/site" }, fetchImpl) };
};

describe("the GitHub REST client", () => {
	it("sends the token only as a bearer header, with the API version", async () => {
		const { github, requests } = client({ "GET /repos/acme/site": { default_branch: "main", allow_auto_merge: true } });
		expect(await github.getRepo()).toEqual({ defaultBranch: "main", allowAutoMerge: true });
		expect(requests[0]?.headers).toMatchObject({
			Authorization: "Bearer ghp_secret",
			"X-GitHub-Api-Version": "2022-11-28",
		});
		expect(requests[0]?.url).not.toContain("ghp_secret");
	});

	it("reads a branch head through the ref and its commit, and gives null for a branch that does not exist", async () => {
		const { github, requests } = client({
			"GET /repos/acme/site/git/ref/heads/monti/publish": { object: { sha: "c1" } },
			"GET /repos/acme/site/git/commits/c1": { tree: { sha: "t1" } },
		});
		expect(await github.getBranchHead("monti/publish")).toEqual({ commitSha: "c1", treeSha: "t1" });
		expect(requests.map((request) => request.url.replace("https://api.github.com", ""))).toEqual([
			"/repos/acme/site/git/ref/heads/monti/publish",
			"/repos/acme/site/git/commits/c1",
		]);
		expect(await github.getBranchHead("missing")).toBeNull();
	});

	it("lists the blobs under a folder and refuses a listing GitHub cut off", async () => {
		const tree = [
			{ path: "content/a.md", type: "blob", sha: "s1" },
			{ path: "content/dir", type: "tree", sha: "s2" },
			{ path: "content/dir/b.md", type: "blob", sha: "s3" },
			{ path: "README.md", type: "blob", sha: "s4" },
		];
		const { github } = client({ "GET /repos/acme/site/git/trees/t1?recursive=1": { tree, truncated: false } });
		expect([...(await github.listFiles({ commitSha: "c", treeSha: "t1" }, "content"))]).toEqual([
			["content/a.md", "s1"],
			["content/dir/b.md", "s3"],
		]);
		expect((await github.listFiles({ commitSha: "c", treeSha: "t1" }, "")).size).toBe(3);
		const cut = client({ "GET /repos/acme/site/git/trees/t1?recursive=1": { tree, truncated: true } }).github;
		await expect(cut.listFiles({ commitSha: "c", treeSha: "t1" }, "")).rejects.toThrow(/cut the file list/);
	});

	it("decodes a blob as UTF-8 and writes one as text", async () => {
		const { github, requests } = client({
			"GET /repos/acme/site/git/blobs/b1": { content: Buffer.from("한글 text").toString("base64"), encoding: "base64" },
			"POST /repos/acme/site/git/blobs": { sha: "b2" },
		});
		expect(await github.getBlob("b1")).toBe("한글 text");
		expect(await github.createBlob("hello")).toBe("b2");
		expect(requests[1]?.body).toEqual({ content: "hello", encoding: "utf-8" });
	});

	it("builds a tree with files and deletions, a commit, and moves a branch", async () => {
		const { github, requests } = client({
			"POST /repos/acme/site/git/trees": { sha: "t2" },
			"POST /repos/acme/site/git/commits": { sha: "c2" },
			"PATCH /repos/acme/site/git/refs/heads/main": {},
			"POST /repos/acme/site/git/refs": {},
		});
		expect(
			await github.createTree({
				baseTree: "t1",
				entries: [
					{ path: "a.md", sha: "b1" },
					{ path: "old.md", sha: null },
				],
			}),
		).toBe("t2");
		expect(requests[0]?.body).toEqual({
			base_tree: "t1",
			tree: [
				{ path: "a.md", mode: "100644", type: "blob", sha: "b1" },
				{ path: "old.md", mode: "100644", type: "blob", sha: null },
			],
		});
		expect(await github.createCommit({ message: "m", tree: "t2", parents: ["c1"] })).toBe("c2");
		await github.updateBranch("main", "c2");
		await github.updateBranch("main", "c2", { force: true });
		await github.createBranch("monti/publish", "c2");
		expect(requests.slice(2).map((request) => [request.method, request.body])).toEqual([
			["PATCH", { sha: "c2", force: false }],
			["PATCH", { sha: "c2", force: true }],
			["POST", { ref: "refs/heads/monti/publish", sha: "c2" }],
		]);
	});

	it("finds and opens pull requests, and turns on auto-merge with the merge method the repo allows", async () => {
		const { github, requests } = client({
			"GET /repos/acme/site/pulls?state=open&head=acme%3Amonti%2Fpublish&base=main": [
				{ number: 7, html_url: "https://github.com/acme/site/pull/7", node_id: "PR_7" },
			],
			"POST /repos/acme/site/pulls": { number: 8, html_url: "https://github.com/acme/site/pull/8", node_id: "PR_8" },
			"GET /repos/acme/site": { allow_squash_merge: false, allow_merge_commit: true },
			"POST /graphql": { data: {} },
		});
		expect(await github.findOpenPullRequest({ head: "monti/publish", base: "main" })).toEqual({
			number: 7,
			url: "https://github.com/acme/site/pull/7",
			nodeId: "PR_7",
		});
		const opened = await github.createPullRequest({ head: "monti/publish", base: "main", title: "T", body: "B" });
		expect(opened).toEqual({ number: 8, url: "https://github.com/acme/site/pull/8", nodeId: "PR_8" });
		await github.enableAutoMerge(opened);
		const graphql = requests.find((request) => request.url.endsWith("/graphql"));
		expect(graphql?.body).toMatchObject({ variables: { id: "PR_8", method: "MERGE" } });
	});

	it("turns a GraphQL refusal of auto-merge into an error", async () => {
		const { github } = client({
			"GET /repos/acme/site": {},
			"POST /graphql": { errors: [{ message: "Pull request is in clean status" }] },
		});
		await expect(github.enableAutoMerge({ number: 1, url: "u", nodeId: "PR_1" })).rejects.toThrow(/clean status/);
		await expect(github.enableAutoMerge({ number: 1, url: "u" })).rejects.toThrow(/no GraphQL id/);
	});

	it("throws a GitHubApiError with the status and message, and one with status 0 when GitHub cannot be reached", async () => {
		const { fetchImpl } = fakeFetch({
			"POST /repos/acme/site/git/blobs": {
				status: 403,
				body: { message: "Resource not accessible by personal access token" },
			},
		});
		const github = createGitHubClient({ token: "t", repo: "acme/site" }, fetchImpl);
		const failure = await github.createBlob("x").catch((error) => error);
		expect(failure).toBeInstanceOf(GitHubApiError);
		expect(failure).toMatchObject({ status: 403 });
		expect(failure.message).toMatch(/403: Resource not accessible/);

		const offline = createGitHubClient({ token: "t", repo: "acme/site" }, async () => {
			throw new TypeError("fetch failed");
		});
		await expect(offline.getRepo()).rejects.toMatchObject({
			status: 0,
			message: expect.stringContaining("could not be reached"),
		});
	});

	it("uses the REST root of a GitHub Enterprise server, and its GraphQL endpoint", async () => {
		const urls: string[] = [];
		const github = createGitHubClient(
			{ token: "t", repo: "acme/site", apiUrl: "https://git.example.com/api/v3/" },
			async (url) => {
				urls.push(url);
				return new Response(JSON.stringify({ allow_squash_merge: true, data: {} }), { status: 200 });
			},
		);
		await github.getRepo();
		await github.enableAutoMerge({ number: 1, url: "u", nodeId: "PR_1" });
		expect(urls).toEqual([
			"https://git.example.com/api/v3/repos/acme/site",
			"https://git.example.com/api/v3/repos/acme/site",
			"https://git.example.com/api/graphql",
		]);
	});

	it("refuses a repo that is not owner/name", () => {
		expect(() => createGitHubClient({ token: "t", repo: "nope" }, async () => new Response("{}"))).toThrow(
			/owner\/name/,
		);
	});
});

describe("blob sha", () => {
	it("is the sha git gives a file with this text (known values)", () => {
		// `printf '' | git hash-object --stdin` and `printf 'hello\n' | git hash-object --stdin`
		expect(blobSha("")).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
		expect(blobSha("hello\n")).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
		// Bytes, not characters.
		expect(blobSha("한")).toBe(blobSha(Buffer.from("한", "utf8").toString("utf8")));
	});
});

describe("webhook signature", () => {
	const body = '{"ref":"refs/heads/main"}';

	it("accepts the HMAC of the raw body under the secret", () => {
		expect(verifySignature("s3cret", body, webhookSignature("s3cret", body))).toBe(true);
	});

	it("refuses another secret, another body, a missing, malformed or truncated signature", () => {
		const good = webhookSignature("s3cret", body);
		expect(verifySignature("other", body, good)).toBe(false);
		expect(verifySignature("s3cret", `${body} `, good)).toBe(false);
		expect(verifySignature("s3cret", body, null)).toBe(false);
		expect(verifySignature("s3cret", body, good.replace("sha256=", "sha1="))).toBe(false);
		expect(verifySignature("s3cret", body, good.slice(0, -2))).toBe(false);
		expect(verifySignature("s3cret", body, "sha256=zz")).toBe(false);
	});
});
