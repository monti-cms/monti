// @vitest-environment jsdom

import { createSite, SiteProvider } from "@monti-cms/core/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import config from "../../../test/cms.config";
import { ConflictDiff, GitSyncPage } from "../git-sync-page";
import { gitSyncMessages } from "../page.messages";

const site = createSite(config);
const t = site.createTranslator(gitSyncMessages);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ Toaster: () => null, toast }));
vi.mock("../../../../admin/src/screens/admin-sidebar", () => ({ AdminSidebar: () => null }));

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

const target = {
	id: "site",
	repo: "acme/site",
	branch: "main",
	folder: "content",
	format: "mdx",
	path: "{collection}/{slug}.{locale}.{ext}",
	mode: "pr",
	prBranch: "monti/publish",
	collections: ["post", "memo"],
	synced: 12,
	queued: 2,
	conflicts: 1,
	lastPull: {
		at: "2026-10-07T09:00:00.000Z",
		head: "abc",
		applied: 1,
		created: 2,
		unchanged: 9,
		conflicts: 1,
		skipped: [{ path: "content/memo/gone.en.mdx", reason: "removed in git" }],
		errors: [{ path: "content/memo/bad.en.mdx", message: "front matter is not valid YAML" }],
	},
	lastFlush: {
		at: "2026-10-07T09:05:00.000Z",
		files: 3,
		commitSha: "1234567890abcdef",
		branch: "monti/publish",
		pullRequestUrl: "https://github.com/acme/site/pull/4",
		note: "Auto-merge is off for this repo, so the pull request waits for a merge",
	},
};

const conflict = {
	id: "site:e1",
	target: "site",
	repo: "acme/site",
	entryId: "e1",
	collection: "memo",
	locale: "en",
	path: "content/memo/hello.en.mdx",
	kind: "changed",
	reason: "both-changed",
	detectedAt: "2026-10-07T09:00:00.000Z",
	label: "Hello",
	serverText: "---\ntitle: Server title\n---\n\nSame body\n",
	gitText: "---\ntitle: Git title\n---\n\nSame body\n",
	gitSha: "a".repeat(40),
};

let status: Record<string, unknown>;
let conflicts: unknown[];
let fetchMock: ReturnType<typeof vi.fn>;
const requests = (method: string) =>
	fetchMock.mock.calls
		.filter(([, init]) => (init as RequestInit | undefined)?.method === method)
		.map(([url, init]) => [url, JSON.parse(String((init as RequestInit).body))]);

beforeEach(() => {
	vi.clearAllMocks();
	status = {
		settings: {
			secretsAvailable: true,
			token: { set: true, hint: "…1234", readable: true },
			webhookSecret: { set: false, readable: true },
			version: 3,
		},
		targets: [target],
	};
	conflicts = [conflict];
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const method = init?.method ?? "GET";
		if (input === "/api/cms/v1/git-sync/status") return json(status);
		if (input === "/api/cms/v1/git-sync/conflicts") return json({ items: conflicts });
		if (method === "POST" && input === "/api/cms/v1/git-sync/pull")
			return json({ results: [{ target: "site", summary: target.lastPull }] });
		if (method === "POST" && input === "/api/cms/v1/git-sync/flush")
			return json({ results: [{ written: 2, removed: 0 }] });
		if (method === "POST" && input === "/api/cms/v1/git-sync/conflicts/resolve") return json({ resolution: "git" });
		if (method === "PUT" && input === "/api/cms/v1/git-sync/settings") return json(status);
		// The sidebar badges the shell asks for.
		return json({ total: 0, items: [], counts: { failed: 0, dead: 0 } });
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderPage = () =>
	render(
		<SiteProvider site={site}>
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<GitSyncPage />
			</QueryClientProvider>
		</SiteProvider>,
	);

describe("Git sync screen: sync tab", () => {
	it("shows each target: repo and branch, mode, folder, path, the last pull and commit, and what went wrong", async () => {
		renderPage();
		const section = await screen.findByRole("region", { name: "site" });
		expect(within(section).getByText("acme/site")).toBeTruthy();
		expect(within(section).getByText(t("target.mode.pr"))).toBeTruthy();
		expect(within(section).getByText("content")).toBeTruthy();
		expect(within(section).getByText("{collection}/{slug}.{locale}.{ext}")).toBeTruthy();
		expect(within(section).getByText(t("target.synced", { count: 12 }))).toBeTruthy();
		expect(within(section).getByText(t("target.queued", { count: 2 }))).toBeTruthy();
		expect(
			within(section).getByText(t("target.pull", { created: 2, applied: 1, unchanged: 9, conflicts: 1 })),
		).toBeTruthy();
		const flush = t("target.flush", { files: 3, commit: "1234567", branch: "monti/publish" });
		expect(
			within(section).getByText(
				(_text, element) => element?.tagName === "DD" && element.textContent?.startsWith(flush) === true,
			),
		).toBeTruthy();
		expect(
			within(section)
				.getByRole("link", { name: t("target.pullRequest") })
				.getAttribute("href"),
		).toBe("https://github.com/acme/site/pull/4");
		expect(within(section).getByText(/front matter is not valid YAML/)).toBeTruthy();
		expect(within(section).getByText(/removed in git/)).toBeTruthy();
	});

	it('"Pull now" pulls the target and reports the result', async () => {
		renderPage();
		fireEvent.click(await screen.findByRole("button", { name: t("pull.now") }));
		await waitFor(() => expect(requests("POST")).toContainEqual(["/api/cms/v1/git-sync/pull", { target: "site" }]));
		await waitFor(() =>
			expect(toast.success).toHaveBeenCalledWith(t("pull.done", { created: 2, applied: 1, conflicts: 1, errors: 1 })),
		);
	});

	it("commits the queue now when something waits", async () => {
		renderPage();
		fireEvent.click(await screen.findByRole("button", { name: t("flush.now") }));
		await waitFor(() => expect(requests("POST")).toContainEqual(["/api/cms/v1/git-sync/flush", { target: "site" }]));
	});

	it("says when no target is set up and when no token is saved", async () => {
		status = { ...status, targets: [] };
		renderPage();
		expect(await screen.findByText(t("sync.empty"))).toBeTruthy();
		cleanup();
		status = {
			settings: {
				secretsAvailable: true,
				token: { set: false, hint: null, readable: true },
				webhookSecret: { set: false, readable: true },
				version: 0,
			},
			targets: [target],
		};
		renderPage();
		expect(await screen.findByText(t("sync.noToken"))).toBeTruthy();
	});
});

describe("Git sync screen: conflicts tab", () => {
	const openConflicts = async () => {
		renderPage();
		fireEvent.mouseDown(await screen.findByRole("tab", { name: new RegExp(t("tab.conflicts")) }));
		fireEvent.click(screen.getByRole("tab", { name: new RegExp(t("tab.conflicts")) }));
	};

	it("badges the tab with the number of conflicts and shows each with a diff of server against git", async () => {
		await openConflicts();
		const section = await screen.findByRole("region", { name: "Hello" });
		expect(within(section).getByText(t("conflicts.reason.both-changed"))).toBeTruthy();
		expect(within(section).getByText("content/memo/hello.en.mdx")).toBeTruthy();
		const removed = section.querySelectorAll('[data-diff="remove"]');
		const added = section.querySelectorAll('[data-diff="add"]');
		expect([...removed].map((line) => line.textContent)).toEqual(["- title: Server title"]);
		expect([...added].map((line) => line.textContent)).toEqual(["+ title: Git title"]);
		expect(section.querySelectorAll('[data-diff="same"]').length).toBeGreaterThan(0);
	});

	it('"Use git version" asks first, then sends the decision with the file the person looked at', async () => {
		await openConflicts();
		fireEvent.click(await screen.findByRole("button", { name: t("conflicts.useGit") }));
		expect(requests("POST").filter(([url]) => String(url).endsWith("/resolve"))).toEqual([]);
		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText(t("conflicts.git.title"))).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: t("conflicts.useGit") }));
		await waitFor(() =>
			expect(requests("POST")).toContainEqual([
				"/api/cms/v1/git-sync/conflicts/resolve",
				{ target: "site", entryId: "e1", resolution: "git", gitSha: "a".repeat(40) },
			]),
		);
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t("conflicts.resolved.git")));
	});

	it('"Use server version" sends the other decision', async () => {
		await openConflicts();
		fireEvent.click(await screen.findByRole("button", { name: t("conflicts.useServer") }));
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: t("conflicts.useServer") }));
		await waitFor(() =>
			expect(requests("POST")).toContainEqual([
				"/api/cms/v1/git-sync/conflicts/resolve",
				expect.objectContaining({ resolution: "server" }),
			]),
		);
	});

	it("says so when there are none", async () => {
		conflicts = [];
		await openConflicts();
		expect(await screen.findByText(t("conflicts.empty"))).toBeTruthy();
	});
});

describe("Git sync screen: settings tab", () => {
	const openSettings = async () => {
		renderPage();
		fireEvent.mouseDown(await screen.findByRole("tab", { name: new RegExp(t("tab.settings")) }));
		fireEvent.click(screen.getByRole("tab", { name: new RegExp(t("tab.settings")) }));
	};

	it("tells whether a token is saved without showing it, and sends a new one with the version it saw", async () => {
		await openSettings();
		expect(await screen.findByText(t("settings.token.state.set", { hint: "…1234" }))).toBeTruthy();
		const input = screen.getByLabelText(t("settings.token")) as HTMLInputElement;
		expect(input.type).toBe("password");
		expect(input.value).toBe("");
		fireEvent.change(input, { target: { value: "ghp_brand_new" } });
		fireEvent.click(screen.getAllByRole("button", { name: t("settings.save") })[0] as HTMLElement);
		await waitFor(() =>
			expect(requests("PUT")).toContainEqual([
				"/api/cms/v1/git-sync/settings",
				{ token: "ghp_brand_new", expectedVersion: 3 },
			]),
		);
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t("settings.saved")));
		expect(input.value).toBe("");
	});

	it("shows the webhook URL, makes a webhook secret and saves it", async () => {
		await openSettings();
		const url = (await screen.findByLabelText(t("settings.webhook.url"))) as HTMLInputElement;
		expect(url.value).toMatch(/\/api\/cms\/v1\/git-sync\/webhook$/);
		fireEvent.click(screen.getByRole("button", { name: t("settings.generate") }));
		const secret = screen.getByLabelText(t("settings.webhook")) as HTMLInputElement;
		const generated = secret.value;
		expect(generated).toMatch(/^[0-9a-f]{64}$/);
		fireEvent.click(screen.getAllByRole("button", { name: t("settings.save") })[1] as HTMLElement);
		await waitFor(() =>
			expect(requests("PUT")).toContainEqual([
				"/api/cms/v1/git-sync/settings",
				{ webhookSecret: generated, expectedVersion: 3 },
			]),
		);
	});

	it("forgets the token on request", async () => {
		await openSettings();
		fireEvent.click(await screen.findByRole("button", { name: t("settings.remove") }));
		await waitFor(() =>
			expect(requests("PUT")).toContainEqual(["/api/cms/v1/git-sync/settings", { token: null, expectedVersion: 3 }]),
		);
	});

	it("explains that nothing can be saved when the server has no CMS secret", async () => {
		status = { ...status, settings: { ...(status.settings as object), secretsAvailable: false } };
		await openSettings();
		expect(await screen.findByText(t("settings.secretMissing"))).toBeTruthy();
		fireEvent.change(screen.getByLabelText(t("settings.token")), { target: { value: "x" } });
		expect((screen.getAllByRole("button", { name: t("settings.save") })[0] as HTMLButtonElement).disabled).toBe(true);
	});
});

describe("ConflictDiff", () => {
	it("marks a removed server version and says when the two are the same", () => {
		const { container, rerender } = render(
			<SiteProvider site={site}>
				<ConflictDiff serverText={null} gitText={"a\nb"} />
			</SiteProvider>,
		);
		expect(screen.getByText(new RegExp(t("conflicts.serverRemoved").replace(/[()]/g, "\\$&")))).toBeTruthy();
		expect(container.querySelectorAll('[data-diff="add"]')).toHaveLength(2);
		rerender(
			<SiteProvider site={site}>
				<ConflictDiff serverText={"a\nb"} gitText={"a\nb"} />
			</SiteProvider>,
		);
		expect(screen.getByText(t("conflicts.same"))).toBeTruthy();
	});
});
