import { definePlugin } from "@monti-cms/core";
import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import type { Folder } from "@monti-cms/core/runtime";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import { renderInRouter } from "../../test/router";
import { SidebarProvider } from "../../ui/sidebar";
import { AdminSidebar, type AdminSidebarProps, type FolderNavigation } from "../admin-sidebar";
import { screensMessages } from "../messages";
import { withSite } from "./site-wrapper";

afterEach(cleanup);

const t = testSite.createTranslator(screensMessages);
const site = createSite({
	...testConfig,
	plugins: [
		definePlugin({
			name: "tools",
			options: {},
			nav: [
				{ path: "tools", label: "Tools page", icon: "plug" },
				{ path: "more", label: "More page" },
			],
		}),
	],
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

const folder = (id: string, name: string, parentId: string | null = null): Folder => ({
	id,
	collection: site.DEFAULT_COLLECTION,
	parentId,
	name,
	position: 0,
	version: 1,
});
const folderNav = (folders: Folder[], overrides: Partial<FolderNavigation> = {}): FolderNavigation => ({
	collection: site.DEFAULT_COLLECTION,
	currentFolder: "all",
	includeDescendants: false,
	folders,
	folderActions: {
		requestCreate: vi.fn(),
		requestRename: vi.fn(),
		requestDelete: vi.fn(),
		requestMove: vi.fn(),
	} as unknown as FolderNavigation["folderActions"],
	onSelectFolder: vi.fn(),
	onIncludeDescendantsChange: vi.fn(),
	onDropEntries: vi.fn(),
	onCreateEntry: vi.fn(),
	...overrides,
});

describe("sidebar structure", () => {
	it("has Content (each collection, Media), Tools (Templates, plugin pages, Event log), then Trash", () => {
		renderSidebar();
		const collections = site.COLLECTIONS.map((collection) => site.COLLECTION_DEFINITIONS[collection].label);
		expect(labels(menu(t("sidebar.content")))).toEqual([...collections, t("sidebar.media")]);
		expect(labels(menu(t("sidebar.tools")))).toEqual([
			t("sidebar.templates"),
			"Tools page",
			"More page",
			t("sidebar.events"),
		]);
		expect(labels(menu(t("sidebar.trash")))).toEqual([t("sidebar.trash")]);
		// Order on the page: content, tools, trash, then Settings in the footer.
		const all = screen.getAllByRole("link").map((link) => link.textContent?.trim());
		const at = (label: string) => all.indexOf(label);
		expect(at(t("sidebar.media"))).toBeLessThan(at(t("sidebar.templates")));
		expect(at(t("sidebar.templates"))).toBeLessThan(at("Tools page"));
		expect(at(t("sidebar.events"))).toBeLessThan(at(t("sidebar.trash")));
		expect(at(t("sidebar.trash"))).toBeLessThan(at(t("sidebar.settings")));
	});

	it("keeps Settings and the theme toggle in the footer, and Trash out of it", () => {
		const { container } = renderSidebar();
		const footer = container.querySelector('[data-sidebar="footer"]') as HTMLElement;
		expect(labels(footer)).toEqual([t("sidebar.settings")]);
		expect(within(footer).queryByText(t("sidebar.trash"))).toBeNull();
		expect(within(footer).getAllByRole("button").length).toBeGreaterThan(0);
	});

	it("draws no separate Folders group", () => {
		renderSidebar({ folderNav: folderNav([folder("f1", "News")]) });
		expect(screen.queryByText("Folders")).toBeNull();
	});

	it("links each item to its own address", () => {
		renderSidebar();
		const href = (name: string) => screen.getByRole("link", { name }).getAttribute("href");
		expect(href(t("sidebar.templates"))).toBe(site.adminHref("/templates"));
		expect(href(t("sidebar.events"))).toBe(site.adminHref("/events"));
		expect(href("Tools page")).toBe(site.adminHref("/tools/tools"));
		expect(href("More page")).toBe(site.adminHref("/tools/more"));
		expect(href(t("sidebar.settings"))).toBe(site.adminHref("/settings/collections"));
	});

	it("leaves Templates out when the site turns them off", () => {
		const off = createSite({ ...testConfig, admin: { ...testConfig.admin, templates: false } } as AnyCmsConfig);
		renderSidebar({}, off);
		expect(screen.queryByRole("link", { name: t("sidebar.templates") })).toBeNull();
	});

	it("marks the screen that is open", () => {
		renderSidebar({ activeNav: "tools:more" });
		const current = screen
			.getAllByRole("link")
			.filter((link) => link.getAttribute("aria-current") === "page")
			.map((link) => link.textContent?.trim());
		expect(current).toEqual(["More page"]);
		cleanup();
		renderSidebar({ activeNav: "settings" });
		expect(screen.getByRole("link", { name: t("sidebar.settings") }).getAttribute("aria-current")).toBe("page");
	});

	it("puts the failed-delivery badge on the Event log, not on Settings, only when there are failures", () => {
		renderSidebar({ eventsCount: 4 });
		const badge = t("sidebar.eventsBadge", { count: 4 });
		expect(within(menu(t("sidebar.tools"))).getByLabelText(badge)).toBeTruthy();
		expect(within(menu(t("sidebar.settings"))).queryByLabelText(badge)).toBeNull();
		expect(screen.getAllByLabelText(badge)).toHaveLength(1);
		cleanup();
		renderSidebar({ eventsCount: 0 });
		expect(screen.queryByLabelText(/failed event deliveries/)).toBeNull();
	});

	it("keeps the trash count badge on Trash", () => {
		renderSidebar({ trashCount: 7 });
		expect(within(menu(t("sidebar.trash"))).getByLabelText(t("sidebar.trashBadge", { count: 7 }))).toBeTruthy();
	});
});

describe("folder tree under a collection", () => {
	const name = site.COLLECTION_DEFINITIONS[site.DEFAULT_COLLECTION].label;
	const tree = () => screen.getByRole("list", { name: t("sidebar.folderTree", { label: name }) });

	it("opens under the active collection: All, the folders, nested ones when expanded, then Add folder", () => {
		const folders = [folder("a", "Dev"), folder("b", "Essays"), folder("c", "Next.js", "a")];
		renderSidebar({ folderNav: folderNav(folders, { currentFolder: "c" }) });
		const rows = within(tree())
			.getAllByRole("button")
			.map((button) => button.textContent?.trim())
			.filter(Boolean);
		expect(rows).toEqual([t("sidebar.folderAll"), "Dev", "Next.js", "Essays", t("list.folderAdd")]);
		// Under the collection entry, before the next collection.
		const content = menu(t("sidebar.content"));
		const order = [...content.querySelectorAll("a, ul[aria-label]")].map((node) => node.textContent?.trim() ?? "");
		expect(order.findIndex((text) => text.startsWith(t("sidebar.folderAll")))).toBeGreaterThan(
			order.findIndex((text) => text === name),
		);
	});

	it("hides the subfolders of a collapsed folder, and the chevron opens them", () => {
		const folders = [folder("a", "Dev"), folder("c", "Next.js", "a")];
		renderSidebar({ folderNav: folderNav(folders) });
		expect(within(tree()).queryByText("Next.js")).toBeNull();
		fireEvent.click(within(tree()).getByRole("button", { name: t("sidebar.folderExpand", { name: "Dev" }) }));
		expect(within(tree()).getByText("Next.js")).toBeTruthy();
	});

	it("selects All or a folder, and adds a folder from the last row", () => {
		const nav = folderNav([folder("a", "Dev")]);
		renderSidebar({ folderNav: nav });
		fireEvent.click(within(tree()).getByRole("button", { name: "Dev" }));
		expect(nav.onSelectFolder).toHaveBeenCalledWith("a");
		fireEvent.click(within(tree()).getByRole("button", { name: t("sidebar.folderAll") }));
		expect(nav.onSelectFolder).toHaveBeenCalledWith("all");
		fireEvent.click(within(tree()).getByRole("button", { name: t("list.folderAdd") }));
		expect(nav.folderActions.requestCreate).toHaveBeenCalledWith(null);
	});

	it("marks the open folder", () => {
		renderSidebar({ folderNav: folderNav([folder("a", "Dev")], { currentFolder: "a" }) });
		expect(within(tree()).getByRole("button", { name: "Dev" }).getAttribute("aria-current")).toBe("true");
		expect(
			within(tree())
				.getByRole("button", { name: t("sidebar.folderAll") })
				.getAttribute("aria-current"),
		).toBeNull();
	});

	it("shows a chevron only on a collection that has folders", () => {
		const [first, second] = site.COLLECTIONS;
		renderSidebar({ activeNav: first as string, folderCounts: { [second as string]: 2 } });
		const row = (collection: string) =>
			screen.getByRole("link", { name: site.COLLECTION_DEFINITIONS[collection as typeof first].label });
		expect(row(second as string).querySelector("svg.lucide-chevron-right")).not.toBeNull();
		expect(row(first as string).querySelector("svg[class*=chevron]")).toBeNull();
	});

	it("turns the chevron down on the open collection and keeps the tree away from collections without folders", () => {
		renderSidebar({ folderNav: folderNav([folder("a", "Dev")]) });
		const link = screen.getByRole("link", { name });
		expect(link.querySelector("svg.lucide-chevron-down")).not.toBeNull();
	});

	it("offers only Add folder while the open collection has none, and no chevron", () => {
		renderSidebar({ folderNav: folderNav([]) });
		expect(
			within(tree())
				.getAllByRole("button")
				.map((button) => button.textContent?.trim()),
		).toEqual([t("list.folderAdd")]);
		expect(screen.getByRole("link", { name }).querySelector("svg[class*=chevron]")).toBeNull();
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
