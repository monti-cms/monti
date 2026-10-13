import { definePlugin } from "@monti-cms/core";
import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import { renderInRouter } from "../../test/router";
import { SidebarProvider } from "../../ui/sidebar";
import { AdminSidebar, type AdminSidebarProps } from "../admin-sidebar";
import { screensMessages } from "../messages";
import { withSite } from "./site-wrapper";

afterEach(cleanup);

const t = testSite.createTranslator(screensMessages);
const site = createSite({
	...testConfig,
	plugins: [definePlugin({ name: "tools", options: {}, nav: [{ path: "tools", label: "Tools" }] })],
} as AnyCmsConfig);

const renderSidebar = (props: Partial<AdminSidebarProps> = {}, target = site) =>
	renderInRouter(
		withSite(
			<SidebarProvider>
				<AdminSidebar activeNav={target.DEFAULT_COLLECTION} {...props} />
			</SidebarProvider>,
			target,
		),
	);
const labels = (container: HTMLElement) =>
	within(container)
		.getAllByRole("link")
		.map((link) => link.textContent?.trim());
const menu = (name: string) => screen.getByRole("list", { name });

describe("sidebar structure", () => {
	it("has Content (each collection, then Media), one Settings entry, and Trash pinned in the footer", () => {
		const { container } = renderSidebar();
		const collections = site.COLLECTIONS.map((collection) => site.COLLECTION_DEFINITIONS[collection].label);
		expect(labels(menu(t("sidebar.content")))).toEqual([...collections, t("sidebar.media")]);
		expect(labels(menu(t("sidebar.settings")))).toEqual([t("sidebar.settings")]);

		const footer = container.querySelector('[data-sidebar="footer"]') as HTMLElement;
		expect(labels(footer)).toEqual([t("sidebar.trash")]);
		// Order on the page: content, settings, trash.
		const all = screen.getAllByRole("link").map((link) => link.textContent?.trim());
		const at = (label: string) => all.indexOf(label);
		expect(at(t("sidebar.media"))).toBeLessThan(at(t("sidebar.settings")));
		expect(at(t("sidebar.settings"))).toBeLessThan(at(t("sidebar.trash")));
	});

	it("has no item for Templates, Schema, Events or a plugin page: they are Settings tabs", () => {
		renderSidebar();
		const names = screen.getAllByRole("link").map((link) => link.textContent?.trim() ?? "");
		for (const gone of ["Tools", "Events", "Schema", "Body templates", "Manage"]) {
			expect(names.some((name) => name.includes(gone))).toBe(false);
		}
		expect(screen.queryByText("Manage")).toBeNull();
	});

	it("links Settings to its first tab and marks it on any settings screen", () => {
		renderSidebar({ activeNav: "settings" });
		const link = screen.getByRole("link", { name: t("sidebar.settings") });
		expect(link.getAttribute("href")).toBe(site.adminHref("/settings/collections"));
		expect(link.getAttribute("aria-current")).toBe("page");
	});

	it("puts the failed-delivery badge on Settings, only when there are failures", () => {
		renderSidebar({ eventsCount: 4 });
		const settings = menu(t("sidebar.settings"));
		expect(within(settings).getByLabelText(t("sidebar.settingsBadge", { count: 4 }))).toBeTruthy();
		cleanup();
		renderSidebar({ eventsCount: 0 });
		expect(screen.queryByLabelText(/failed event deliveries/)).toBeNull();
	});

	it("keeps the trash count badge on Trash", () => {
		renderSidebar({ trashCount: 7 });
		expect(within(menu(t("sidebar.trash"))).getByLabelText(t("sidebar.trashBadge", { count: 7 }))).toBeTruthy();
	});
});

describe("view site", () => {
	it("is an icon button in the header next to the site name, not a footer row", () => {
		const { container } = renderSidebar();
		const link = screen.getByRole("link", { name: t("sidebar.viewSite") });
		expect(link.getAttribute("href")).toBe(site.SITE_HOME);
		expect(link.getAttribute("target")).toBe("_blank");
		expect(link.textContent?.trim()).toBe("");
		const header = container.querySelector('[data-sidebar="header"]') as HTMLElement;
		expect(header.contains(link)).toBe(true);
		const footer = container.querySelector('[data-sidebar="footer"]') as HTMLElement;
		expect(footer.contains(link)).toBe(false);
	});
});
