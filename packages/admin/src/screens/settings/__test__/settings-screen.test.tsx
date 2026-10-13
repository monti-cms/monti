import { definePlugin } from "@monti-cms/core";
import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../../core/test/site";
import { renderInRouter } from "../../../test/router";
import { withSite } from "../../__test__/site-wrapper";
import { AdminQueryProvider } from "../../shared/query-provider";
import { settingsMessages } from "../messages";
import { SettingsScreen } from "../settings-screen";

const failed = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../schema/schema-screen", () => ({
	SchemaSettings: ({ tab }: { tab: string }) => <p>schema editor: {tab}</p>,
}));
vi.mock("../../templates/template-manager", () => ({ TemplateManager: () => <p>templates screen</p> }));
vi.mock("../../events/events-screen", () => ({ EventsScreen: () => <p>events screen</p> }));
vi.mock("../../events/events-api", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../events/events-api")>()),
	countFailedEvents: async () => failed.count,
}));

const t = testSite.createTranslator(settingsMessages);
const withPlugin = (admin: Record<string, unknown> = {}) =>
	createSite({
		...testConfig,
		admin: { ...testConfig.admin, ...admin },
		plugins: [
			definePlugin({
				name: "tools",
				options: {},
				nav: [
					{ path: "tools", label: "Tools", icon: "plug" },
					{ path: "more", label: "More" },
				],
			}),
		],
	} as AnyCmsConfig);

beforeEach(() => {
	failed.count = 0;
	vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => ({ total: 0 }) }));
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderSettings = (tab: string, site = testSite, children?: React.ReactNode) =>
	renderInRouter(
		withSite(
			<AdminQueryProvider>
				<SettingsScreen tab={tab}>{children}</SettingsScreen>
			</AdminQueryProvider>,
			site,
		),
	);
const tabBar = () => screen.getByRole("navigation", { name: t("tabs.label") });

describe("settings tabs", () => {
	it("lists the core tabs in order, then the plugin tabs, each with its own address", () => {
		const site = withPlugin();
		renderSettings("collections", site);
		const links = within(tabBar()).getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual([
			t("tab.collections"),
			t("tab.locales"),
			t("tab.site"),
			t("tab.admin"),
			t("tab.file"),
			t("tab.templates"),
			t("tab.events"),
			"Tools",
			"More",
		]);
		expect(links.map((link) => link.getAttribute("href"))).toEqual(
			["collections", "locales", "site", "admin", "file", "templates", "events", "tools", "more"].map((id) =>
				site.adminHref(`/settings/${id}`),
			),
		);
	});

	it("marks the open tab", () => {
		renderSettings("site");
		const current = within(tabBar())
			.getAllByRole("link")
			.filter((link) => link.getAttribute("aria-current") === "page");
		expect(current.map((link) => link.textContent)).toEqual([t("tab.site")]);
	});

	it("drops the Templates tab when the site turns templates off", () => {
		renderSettings("collections", withPlugin({ templates: false }));
		expect(within(tabBar()).queryByRole("link", { name: t("tab.templates") })).toBeNull();
		expect(within(tabBar()).getByRole("link", { name: t("tab.events") })).toBeTruthy();
	});

	it("shows a plugin page as a tab: its content is the tab body, and there is no sidebar item for it", () => {
		renderSettings("tools", withPlugin(), <p>tools page</p>);
		expect(screen.getByText("tools page")).toBeTruthy();
		expect(screen.queryByText(/schema editor/)).toBeNull();
		const sidebarLinks = screen.getAllByRole("link").filter((link) => !tabBar().contains(link));
		expect(sidebarLinks.map((link) => link.textContent)).not.toContain("Tools");
	});

	it("shows the schema editor on the schema tabs, the templates and the event log on theirs", () => {
		const { unmount } = renderSettings("locales");
		expect(screen.getByText("schema editor: locales")).toBeTruthy();
		unmount();
		renderSettings("templates");
		expect(screen.getByText("templates screen")).toBeTruthy();
		cleanup();
		renderSettings("events");
		expect(screen.getByText("events screen")).toBeTruthy();
	});

	it("keeps the schema editor (and its unsaved draft) mounted while another tab shows", () => {
		const { rerender } = renderSettings("collections");
		const editor = screen.getByText("schema editor: collections");
		const element = (tab: string) =>
			withSite(
				<AdminQueryProvider>
					<SettingsScreen tab={tab} />
				</AdminQueryProvider>,
			);
		rerender(element("events"));
		expect(screen.getByText("schema editor: collections")).toBe(editor);
		expect(editor.closest(".hidden")).toBeTruthy();
		expect(screen.getByText("events screen")).toBeTruthy();
	});

	it("puts the failed-delivery count on the Event log tab and on the sidebar Settings item, only when there are failures", async () => {
		failed.count = 3;
		renderSettings("collections");
		const badge = t("tab.eventsBadge", { count: 3 });
		await waitFor(() => expect(within(tabBar()).getByLabelText(badge)).toBeTruthy());
		expect(screen.getAllByLabelText(badge)).toHaveLength(2);
	});

	it("shows no badge without failures", async () => {
		renderSettings("collections");
		await waitFor(() => expect(screen.getByRole("link", { name: t("tab.events") })).toBeTruthy());
		expect(screen.queryByLabelText(/failed event deliveries/)).toBeNull();
	});
});
