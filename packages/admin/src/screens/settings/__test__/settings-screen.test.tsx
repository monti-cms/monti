import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { createTestRouter, renderInRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { screensMessages } from "../../messages";
import { AdminQueryProvider } from "../../shared/query-provider";
import { toolsMessages } from "../../tools/messages";
import { settingsMessages } from "../messages";
import { SettingsScreen } from "../settings-screen";
import { SCHEMA_TABS, type SchemaTab } from "../tabs";

vi.mock("../../schema/schema-screen", () => ({
	SchemaSettings: ({
		tab,
		actionsSlot,
		onChanged,
	}: {
		tab: string;
		actionsSlot?: HTMLElement | null;
		onChanged?: (areas: unknown) => void;
	}) => (
		<div>
			<p>
				schema editor: {tab}
				{actionsSlot ? " (actions slot)" : ""}
			</p>
			<button
				type="button"
				onClick={() =>
					onChanged?.({ tabs: { site: true, locales: false, collections: false, admin: false }, collections: {} })
				}
			>
				report changes
			</button>
		</div>
	),
}));

const t = testSite.createTranslator(settingsMessages);
const sidebarText = testSite.createTranslator(screensMessages);
const toolsText = testSite.createTranslator(toolsMessages);

afterEach(() => {
	cleanup();
	// The open tab is read from the address: start every test from one that names no tab.
	window.history.replaceState(null, "", "/");
});

const element = (tab: SchemaTab) =>
	withSite(
		<AdminQueryProvider>
			<SettingsScreen tab={tab} />
		</AdminQueryProvider>,
	);
const renderSettings = (tab: SchemaTab) => renderInRouter(element(tab));
const tabBar = () => screen.getByRole("tablist", { name: t("tabs.label") });

describe("settings tabs", () => {
	it("lists the tabs in order, each with its own address", () => {
		renderSettings("collections");
		const links = within(tabBar()).getAllByRole("tab");
		const ids = SCHEMA_TABS;
		expect(links.map((link) => link.textContent)).toEqual(ids.map((id) => t(`tab.${id}`)));
		expect(links.map((link) => link.getAttribute("href"))).toEqual(
			ids.map((id) => testSite.adminHref(`/settings/${id}`)),
		);
	});

	it("marks the open tab", () => {
		renderSettings("site");
		const current = within(tabBar())
			.getAllByRole("tab")
			.filter((link) => link.getAttribute("aria-selected") === "true");
		expect(current.map((link) => link.textContent)).toEqual([t("tab.site")]);
	});

	it("has no tab for the pages of the tools page: they have their own", () => {
		renderSettings("collections");
		const names = within(tabBar())
			.getAllByRole("tab")
			.map((link) => link.textContent);
		for (const key of ["tab.templates", "tab.events", "tab.data", "tab.apiKeys"] as const)
			expect(names).not.toContain(toolsText(key));
	});

	it("moves between tabs in place: the address changes, the editor and its draft stay, and no navigation is asked of the router", () => {
		window.history.replaceState(null, "", "/admin/settings/collections?collection=tag&section=fields");
		const nav = createTestRouter();
		nav.render(element("collections"));
		const editor = screen.getByText(/schema editor: collections/);
		fireEvent.click(within(tabBar()).getByRole("tab", { name: t("tab.locales") }));
		expect(screen.getByText(/schema editor: locales/)).toBe(editor);
		expect(window.location.pathname).toBe("/admin/settings/locales");
		// The collection that was open is still named in the address for the way back.
		expect(window.location.search).toBe("?collection=tag&section=fields");
		expect(nav.navigate).not.toHaveBeenCalled();
		expect(
			within(tabBar())
				.getByRole("tab", { name: t("tab.locales") })
				.getAttribute("aria-selected"),
		).toBe("true");
	});

	it("puts a dot, named for a screen reader, on the tabs that hold draft changes", () => {
		renderSettings("collections");
		expect(within(tabBar()).queryAllByRole("img", { name: t("changed") })).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: "report changes" }));
		const site = within(tabBar()).getByRole("tab", { name: new RegExp(t("tab.site")) });
		expect(within(site).getByRole("img", { name: t("changed") })).toBeTruthy();
		expect(within(tabBar()).getAllByRole("img", { name: t("changed") })).toHaveLength(1);
	});

	it("shows the schema editor for the open tab", () => {
		renderSettings("locales");
		expect(screen.getByText(/schema editor: locales/)).toBeTruthy();
	});

	it("keeps the schema editor (and its unsaved draft) mounted while moving between tabs", () => {
		const { rerender } = renderSettings("collections");
		const editor = screen.getByText(/schema editor: collections/);
		rerender(element("site"));
		expect(screen.getByText(/schema editor: site/)).toBe(editor);
	});

	it("has its own page header: title and a slot for the editor's badge", () => {
		renderSettings("collections");
		expect(screen.getByRole("heading", { level: 1, name: t("title") })).toBeTruthy();
		expect(screen.getByText(/actions slot/)).toBeTruthy();
		// One title only: the shell draws no title bar of its own here.
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
	});

	it("marks Settings in the sidebar", () => {
		renderSettings("collections");
		const link = screen.getByRole("link", { name: sidebarText("sidebar.settings") });
		expect(link.getAttribute("aria-current")).toBe("page");
	});
});
