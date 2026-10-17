import { type CmsConfig, definePlugin } from "@monti-cms/core";
import type { Cms } from "@monti-cms/core/server";
import { createSite } from "@monti-cms/core/site";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import type { AdminServer } from "../../../host/server";
import { renderInRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { ShellPage } from "../../shared/admin-shell";
import { AdminQueryProvider } from "../../shared/query-provider";
import ToolsPage from "../page";

vi.mock("../../require-admin", () => ({ requireAdminPage: async () => undefined }));

afterEach(cleanup);

const Stats = () => <p>stats page body</p>;
const site = createSite({
	...testConfig,
	plugins: [
		definePlugin({
			name: "stats",
			options: {},
			nav: [{ path: "stats", label: "Post stats", icon: "plug" }],
			admin: async () => ({ default: { pages: { stats: Stats } } }),
		}),
		definePlugin({ name: "quiet", options: {}, nav: [{ path: "quiet", label: "Quiet" }] }),
	],
} as CmsConfig);
const cms = { site } as unknown as Cms;
const server = (): AdminServer => ({
	redirect: vi.fn((href: string) => {
		throw new Error(`redirect:${href}`);
	}),
	notFound: vi.fn(() => {
		throw new Error("not-found");
	}),
});

describe("tools page", () => {
	it("renders the plugin's page inside the frame with the nav label as the title", async () => {
		const element = await ToolsPage({ cms, server: server(), path: "stats" });
		renderInRouter(withSite(<AdminQueryProvider>{element}</AdminQueryProvider>, site));
		expect(screen.getByText("stats page body")).toBeTruthy();
		expect(screen.getByRole("heading", { level: 1, name: "Post stats" })).toBeTruthy();
	});

	it("marks the page in the sidebar Tools group", () => {
		renderInRouter(
			withSite(
				<AdminQueryProvider>
					<ShellPage title="Post stats" nav="tools:stats">
						<Stats />
					</ShellPage>
				</AdminQueryProvider>,
				site,
			),
		);
		const link = screen.getByRole("link", { name: "Post stats" });
		expect(link.getAttribute("aria-current")).toBe("page");
		expect(link.getAttribute("href")).toBe(site.adminHref("/tools/stats"));
	});

	it("is a 404 for a path no plugin's nav item has", async () => {
		for (const path of ["nope", "events", "settings"]) {
			await expect(ToolsPage({ cms, server: server(), path })).rejects.toThrow("not-found");
		}
	});

	it("says what is missing for a nav item whose plugin has no page for it", async () => {
		const element = await ToolsPage({ cms, server: server(), path: "quiet" });
		renderInRouter(withSite(<AdminQueryProvider>{element}</AdminQueryProvider>, site));
		expect(screen.getByRole("heading", { level: 1, name: "Quiet" })).toBeTruthy();
		// The text follows the admin language; it names the plugin and the page that is missing.
		expect(screen.getByText((text) => text.includes('"quiet"') && text.includes("defineAdminPlugin"))).toBeTruthy();
	});
});
