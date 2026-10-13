import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { renderInRouter } from "../../../test/router";
import { withSite } from "../../__test__/site-wrapper";
import { screensMessages } from "../../messages";
import { AdminQueryProvider } from "../../shared/query-provider";
import { settingsMessages } from "../messages";
import { SettingsScreen } from "../settings-screen";
import type { SchemaTab } from "../tabs";

vi.mock("../../schema/schema-screen", () => ({
	SchemaSettings: ({ tab }: { tab: string }) => <p>schema editor: {tab}</p>,
}));

const t = testSite.createTranslator(settingsMessages);
const sidebarText = testSite.createTranslator(screensMessages);

afterEach(cleanup);

const element = (tab: SchemaTab) =>
	withSite(
		<AdminQueryProvider>
			<SettingsScreen tab={tab} />
		</AdminQueryProvider>,
	);
const renderSettings = (tab: SchemaTab) => renderInRouter(element(tab));
const tabBar = () => screen.getByRole("navigation", { name: t("tabs.label") });

describe("settings tabs", () => {
	it("lists the schema file's tabs in order, each with its own address", () => {
		renderSettings("collections");
		const links = within(tabBar()).getAllByRole("link");
		const ids = ["collections", "locales", "site", "admin", "file"] as const;
		expect(links.map((link) => link.textContent)).toEqual(ids.map((id) => t(`tab.${id}`)));
		expect(links.map((link) => link.getAttribute("href"))).toEqual(
			ids.map((id) => testSite.adminHref(`/settings/${id}`)),
		);
	});

	it("marks the open tab", () => {
		renderSettings("site");
		const current = within(tabBar())
			.getAllByRole("link")
			.filter((link) => link.getAttribute("aria-current") === "page");
		expect(current.map((link) => link.textContent)).toEqual([t("tab.site")]);
	});

	it("has no tab for templates, the event log or a plugin page: they are in the sidebar", () => {
		renderSettings("collections");
		const names = within(tabBar())
			.getAllByRole("link")
			.map((link) => link.textContent);
		expect(names).not.toContain(sidebarText("sidebar.templates"));
		expect(names).not.toContain(sidebarText("sidebar.events"));
	});

	it("shows the schema editor for the open tab", () => {
		renderSettings("locales");
		expect(screen.getByText("schema editor: locales")).toBeTruthy();
	});

	it("keeps the schema editor (and its unsaved draft) mounted while moving between tabs", () => {
		const { rerender } = renderSettings("collections");
		const editor = screen.getByText("schema editor: collections");
		rerender(element("site"));
		expect(screen.getByText("schema editor: site")).toBe(editor);
	});

	it("marks Settings in the sidebar", () => {
		renderSettings("collections");
		const link = screen.getByRole("link", { name: sidebarText("sidebar.settings") });
		expect(link.getAttribute("aria-current")).toBe("page");
	});
});
