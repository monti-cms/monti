import { type CmsConfig, definePlugin } from "@monti-cms/core";
import type { Cms } from "@monti-cms/core/server";
import { createSite } from "@monti-cms/core/site";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import type { AdminServer } from "../../../host/server";
import { type FakeApi, fakeApi } from "../../../test/fake-api";
import { renderInRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { AdminQueryProvider } from "../../shared/query-provider";
import { toolsMessages } from "../messages";
import ToolsPage from "../page";
import { toolsTabs } from "../tools-tabs";

let api: FakeApi;
beforeEach(() => {
	api = fakeApi()
		.withEmptyRail()
		// The failed deliveries the tabs count: 3 failed and 1 dead.
		.on("GET /v1/events", () => ({
			items: [],
			total: 0,
			counts: { pending: 0, delivering: 0, delivered: 0, failed: 3, dead: 1, dismissed: 0 },
		}))
		.install();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const Stats = () => <p>stats page body</p>;
const site = createSite({
	...testConfig,
	plugins: [
		definePlugin({
			name: "stats",
			options: {},
			nav: [{ path: "stats", label: "Post stats" }],
			admin: async () => ({ default: { pages: { stats: Stats } } }),
		}),
		definePlugin({ name: "quiet", options: {}, nav: [{ path: "quiet", label: "Quiet" }] }),
	],
} as CmsConfig);
const t = site.createTranslator(toolsMessages);
/** The CMS the page is handed: the site, and the auth gateway (the edge) letting the admin in. */
const cms = { site, authGateway: { verifyAdmin: async () => ({}) } } as unknown as Cms;
const server = (): AdminServer => ({
	redirect: vi.fn((href: string) => {
		throw new Error(`redirect:${href}`);
	}),
	notFound: vi.fn(() => {
		throw new Error("not-found");
	}),
});
const open = async (path: string | undefined) => {
	const element = await ToolsPage({ cms, server: server(), path });
	return renderInRouter(withSite(<AdminQueryProvider>{element}</AdminQueryProvider>, site));
};
const tabs = () => screen.getByRole("navigation", { name: t("tabs.label") });

describe("the tools page", () => {
	it("ADMIN-U1 goes to the first tab from the bare tools address", async () => {
		await expect(ToolsPage({ cms, server: server(), path: undefined })).rejects.toThrow(
			`redirect:${toolsTabs(site)[0]?.href}`,
		);
	});

	it("ADMIN-U1 is a 404 for a path that is neither a built-in tab nor a plugin page", async () => {
		for (const path of ["nope", "settings", "media"]) {
			await expect(open(path)).rejects.toThrow("not-found");
		}
	});

	it("PLUG-A1 shows a plugin's page as the last tab, under the same title", async () => {
		await open("stats");
		expect(screen.getByText("stats page body")).toBeInTheDocument();
		expect(screen.getByRole("heading", { level: 1, name: t("title") })).toBeInTheDocument();
		const links = within(tabs()).getAllByRole("link");
		const current = links.find((link) => link.getAttribute("aria-current") === "page");
		expect(current?.textContent?.trim()).toBe("Post stats");
	});

	it("PLUG-A1 says what is missing for a plugin page the plugin does not draw", async () => {
		await open("quiet");
		expect(
			screen.getByText((text) => text.includes('"quiet"') && text.includes("defineAdminPlugin")),
		).toBeInTheDocument();
	});

	it("EVENT-F1 counts the failed deliveries on the activity log tab", async () => {
		// The Data tab's own body: the export formats, whether the site is empty, and the export summary.
		api
			.on("GET /v1/meta", () => ({ formats: [] }))
			.on("GET /v1/import/restore", () => ({ empty: false, entries: 1, folders: 0, media: 0 }))
			.on("POST /v1/export/summary", ({ body }) => ({
				scope: body.scope,
				entries: 0,
				addedByTranslations: 0,
				notPublished: 0,
				notFound: 0,
				templates: 0,
				folders: 0,
				addresses: 0,
				media: 0,
			}));
		await open("data");
		const events = within(tabs()).getByRole("link", { name: new RegExp(t("tab.events")) });
		await waitFor(() => expect(within(events).getByLabelText(t("failedCount", { count: 4 }))).toBeInTheDocument());
		const others = within(tabs())
			.getAllByRole("link")
			.filter((link) => link !== events);
		for (const link of others) expect(within(link).queryByLabelText(/\d/)).toBeNull();
	});
});
