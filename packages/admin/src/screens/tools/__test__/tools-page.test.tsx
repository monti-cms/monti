import { type CmsConfig, definePlugin } from "@monti-cms/core";
import type { Cms } from "@monti-cms/core/server";
import { createSite } from "@monti-cms/core/site";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import type { AdminServer } from "../../../host/server";
import { jsonResponse } from "../../../test/fetch";
import { renderInRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { AdminQueryProvider } from "../../shared/query-provider";
import { toolsMessages } from "../messages";
import ToolsPage from "../page";
import { toolsTabs } from "../tools-tabs";

vi.mock("../../require-admin", () => ({ requireAdminPage: async () => undefined }));

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string) =>
			jsonResponse(
				input.includes("/events")
					? { items: [], total: 0, counts: { pending: 0, failed: 3, dead: 1, delivered: 0, recorded: 0 } }
					: { items: [], total: 0 },
			),
		),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const Stats = () => <p>stats page body</p>;
const build = (templates = true) =>
	createSite({
		...testConfig,
		admin: { ...testConfig.admin, templates },
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
const site = build();
const t = site.createTranslator(toolsMessages);
const server = (): AdminServer => ({
	redirect: vi.fn((href: string) => {
		throw new Error(`redirect:${href}`);
	}),
	notFound: vi.fn(() => {
		throw new Error("not-found");
	}),
});
const open = async (path: string | undefined, target = site) => {
	const element = await ToolsPage({ cms: { site: target } as unknown as Cms, server: server(), path });
	return renderInRouter(withSite(<AdminQueryProvider>{element}</AdminQueryProvider>, target));
};
const tabs = () => screen.getByRole("navigation", { name: t("tabs.label") });

describe("the tools page", () => {
	it("goes to the first tab from the bare tools address", async () => {
		await expect(ToolsPage({ cms: { site } as unknown as Cms, server: server(), path: undefined })).rejects.toThrow(
			`redirect:${toolsTabs(site)[0]?.href}`,
		);
	});

	it("is a 404 for a path that is neither a built-in tab nor a plugin page", async () => {
		for (const path of ["nope", "settings", "media"]) {
			await expect(open(path)).rejects.toThrow("not-found");
		}
	});

	it("is a 404 for the templates tab when the site turns templates off", async () => {
		await expect(open("templates", build(false))).rejects.toThrow("not-found");
	});

	it("shows a plugin's page as the last tab, under the same title", async () => {
		await open("stats");
		expect(screen.getByText("stats page body")).toBeTruthy();
		expect(screen.getByRole("heading", { level: 1, name: t("title") })).toBeTruthy();
		const links = within(tabs()).getAllByRole("link");
		const current = links.find((link) => link.getAttribute("aria-current") === "page");
		expect(current?.textContent?.trim()).toBe("Post stats");
	});

	it("says what is missing for a plugin page the plugin does not draw", async () => {
		await open("quiet");
		expect(screen.getByText((text) => text.includes('"quiet"') && text.includes("defineAdminPlugin"))).toBeTruthy();
	});

	it("counts the failed deliveries on the activity log tab", async () => {
		await open("data");
		const events = within(tabs()).getByRole("link", { name: new RegExp(t("tab.events")) });
		await waitFor(() => expect(within(events).getByLabelText(t("failedCount", { count: 4 }))).toBeTruthy());
		const others = within(tabs())
			.getAllByRole("link")
			.filter((link) => link !== events);
		for (const link of others) expect(within(link).queryByLabelText(/\d/)).toBeNull();
	});
});
