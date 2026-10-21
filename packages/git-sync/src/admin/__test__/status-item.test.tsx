// @vitest-environment jsdom

import { createSite } from "@monti-cms/core/site";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse as json } from "../../../../admin/src/test/fetch";
import { createTestRouter } from "../../../../admin/src/test/router";
import { SiteWrapper } from "../../../../admin/src/test/site";
import config from "../../../test/cms.config";
import { GitSyncStatus, syncSummary } from "../status-item";

const site = createSite(config);
const { render } = createTestRouter({ site });

const NOW = Date.parse("2026-10-07T09:10:00.000Z");
const target = (over: Record<string, unknown>) => ({
	id: "site",
	repo: "acme/site",
	branch: "main",
	folder: "content",
	format: "mdx",
	path: "{collection}/{slug}.{locale}.{ext}",
	mode: "pr",
	prBranch: "monti/publish",
	collections: ["post"],
	synced: 1,
	queued: 0,
	conflicts: 0,
	...over,
});

const show = async (targets: unknown[]) => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string) =>
			input === "/api/monti/v1/git-sync/status"
				? json({ keys: { secretsAvailable: true, token: null, webhookSecret: null }, targets })
				: json({}, 404),
		),
	);
	render(
		<SiteWrapper site={site}>
			<GitSyncStatus />
		</SiteWrapper>,
	);
};

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("Git sync status bar item", () => {
	it("says there are conflicts, linking to the Git sync page", async () => {
		await show([target({ conflicts: 2, queued: 3 })]);
		const link = await screen.findByRole("link", { name: /Git: 2 conflicts|Git 충돌 2건/ });
		expect(link.getAttribute("href")).toMatch(/\/tools\/git-sync$/);
	});

	it("says how many commits wait when nothing conflicts", async () => {
		await show([target({ queued: 3 })]);
		expect(await screen.findByRole("link", { name: /Git: 3 waiting|Git 커밋 대기 3건/ })).toBeTruthy();
	});

	it("says when the last sync was, and hides when nothing is set up or nothing has happened", async () => {
		vi.spyOn(Date, "now").mockReturnValue(NOW);
		await show([target({ lastPull: { at: "2026-10-07T09:07:00.000Z" } })]);
		expect(await screen.findByRole("link", { name: /Git synced|Git 동기화됨/ })).toBeTruthy();
		cleanup();
		await show([target({})]);
		await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
		expect(screen.queryByRole("link")).toBeNull();
		cleanup();
		await show([]);
		await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
		expect(screen.queryByRole("link")).toBeNull();
	});

	it("sums the targets: conflicts and queued commits, and the latest of the pulls and commits", () => {
		const summary = syncSummary({
			keys: { secretsAvailable: true, token: null, webhookSecret: null },
			targets: [
				target({ conflicts: 1, queued: 2, lastPull: { at: "2026-10-07T09:00:00.000Z" } }),
				target({ conflicts: 0, queued: 1, lastFlush: { at: "2026-10-07T09:05:00.000Z" } }),
			] as never,
		});
		expect(summary).toEqual({ conflicts: 1, queued: 3, lastAt: Date.parse("2026-10-07T09:05:00.000Z") });
	});
});
