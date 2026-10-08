// @vitest-environment jsdom
import { defineSite } from "@monti-cms/core";
import { createSite, SiteProvider } from "@monti-cms/core/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { schema } from "../site";
import { postStats } from "./index";
import { StatsView } from "./stats-page";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const site = createSite(defineSite({ schema, plugins: [postStats()] }));

describe("an admin page of a plugin (the screen)", () => {
	it("asks the plugin's API and shows the answer", async () => {
		const fetchMock = vi.fn(async (_url: string) => Response.json({ published: 7, draft: 3 }));
		vi.stubGlobal("fetch", fetchMock);
		render(
			<SiteProvider site={site}>
				<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
					<StatsView />
				</QueryClientProvider>
			</SiteProvider>,
		);
		expect(await screen.findByText("7")).toBeTruthy();
		expect(screen.getByText("3")).toBeTruthy();
		expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cms/v1/post-stats/summary");
	});

	it("says why it failed", async () => {
		vi.stubGlobal("fetch", async () =>
			Response.json({ code: "forbidden", message: "Forbidden: not an authorized admin" }, { status: 403 }),
		);
		render(
			<SiteProvider site={site}>
				<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
					<StatsView />
				</QueryClientProvider>
			</SiteProvider>,
		);
		expect((await screen.findByRole("alert")).textContent).toContain("permission");
	});

	it("is listed in the sidebar as a plugin screen", () => {
		expect(site.config.plugins?.find((plugin) => plugin.name === "post-stats")?.nav).toEqual([
			{ path: "post-stats", label: "Post stats", icon: "bar-chart-3" },
		]);
	});
});
