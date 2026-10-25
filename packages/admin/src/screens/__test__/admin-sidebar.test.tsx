import { type CmsConfig, definePlugin } from "@monti-cms/core";
import type { Folder } from "@monti-cms/core/site";
import { createSite } from "@monti-cms/core/site";
import { SidebarProvider } from "@monti-cms/ui";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { renderInRouter } from "../../test/router";
import { siteWithFolders, withSite } from "../../test/site";
import { AdminSidebar, type AdminSidebarProps, type FolderNavigation } from "../admin-sidebar";
import { screensMessages } from "../messages";

afterEach(() => {
	cleanup();
	window.localStorage.clear();
});

const t = testSite.createTranslator(screensMessages);
const tc = testSite.createTranslator(commonMessages);
const site = createSite({
	...testConfig,
	plugins: [
		definePlugin({
			name: "tools",
			options: {},
			nav: [
				{ path: "tools", label: "Tools page", icon: "plug" },
				{ path: "more", label: "More page", group: "site" },
				{ path: "draft", label: "Draft helper", group: "writing" },
			],
		}),
	],
} as CmsConfig);

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
const siteGroup = () => screen.getByRole("button", { name: new RegExp(t("sidebar.site")) });
/** The Site group starts collapsed; opens it the way a person does. */
const openSite = () => {
	if (siteGroup().getAttribute("aria-expanded") !== "true") fireEvent.click(siteGroup());
};

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
	folders,
	folderActions: {
		requestCreate: vi.fn(),
		requestRename: vi.fn(),
		requestDelete: vi.fn(),
		moveFolder: vi.fn(),
		createFolderDirect: vi.fn().mockResolvedValue(undefined),
		renameFolderDirect: vi.fn().mockResolvedValue(undefined),
	} as unknown as FolderNavigation["folderActions"],
	onSelectFolder: vi.fn(),
	onDropEntries: vi.fn(),
	onCreateEntry: vi.fn(),
	...overrides,
});

describe("sidebar structure", () => {
	it("has Content (each collection, Media), Writing, Site, then Trash, with Settings after them", () => {
		renderSidebar();
		openSite();
		const collections = site.COLLECTIONS.map((collection) => site.COLLECTION_DEFINITIONS[collection].label);
		expect(labels(menu(t("sidebar.content")))).toEqual([...collections, t("sidebar.media")]);
		expect(labels(menu(t("sidebar.trash")))).toEqual([t("sidebar.trash")]);
		const all = screen.getAllByRole("link").map((link) => link.textContent?.trim());
		const at = (label: string) => all.indexOf(label);
		expect(at(t("sidebar.media"))).toBeLessThan(at(t("sidebar.templates")));
		expect(at(t("sidebar.templates"))).toBeLessThan(at("Draft helper"));
		expect(at("Draft helper")).toBeLessThan(at(t("sidebar.data")));
		expect(at(t("sidebar.data"))).toBeLessThan(at(t("sidebar.apiKeys")));
		expect(at(t("sidebar.apiKeys"))).toBeLessThan(at(t("sidebar.events")));
		expect(at(t("sidebar.events"))).toBeLessThan(at(t("sidebar.trash")));
		expect(at(t("sidebar.trash"))).toBeLessThan(at(t("sidebar.settings")));
	});

	it("puts a plugin page in Writing when its nav item says so, and in Site otherwise", () => {
		renderSidebar();
		openSite();
		const writing = labels(menu(t("sidebar.writing")));
		const siteItems = labels(menu(t("sidebar.site")));
		expect(writing).toContain("Draft helper");
		expect(writing).toContain(t("sidebar.templates"));
		expect(writing).not.toContain("Tools page");
		// No `group` and an explicit `group: "site"` both land in Site.
		expect(siteItems).toEqual(expect.arrayContaining(["Tools page", "More page", t("sidebar.data")]));
		expect(siteItems).not.toContain("Draft helper");
	});

	it("keeps the Site group collapsed until opened, and opens it when one of its screens is active", () => {
		renderSidebar();
		expect(siteGroup().getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByRole("link", { name: t("sidebar.apiKeys") })).toBeNull();
		fireEvent.click(siteGroup());
		expect(screen.getByRole("link", { name: t("sidebar.apiKeys") })).toBeTruthy();
		cleanup();
		window.localStorage.clear();
		renderSidebar({ activeNav: "api-keys" });
		expect(siteGroup().getAttribute("aria-expanded")).toBe("true");
	});

	it("folds the Site group on request even while one of its screens is open, and then marks the group as the current place", () => {
		renderSidebar({ activeNav: "api-keys" });
		expect(siteGroup().className).not.toContain("font-semibold");
		fireEvent.click(siteGroup());
		expect(siteGroup().getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByRole("link", { name: t("sidebar.apiKeys") })).toBeNull();
		expect(siteGroup().className).toContain("font-semibold");
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
		openSite();
		const href = (name: string) => screen.getByRole("link", { name }).getAttribute("href");
		expect(href(t("sidebar.templates"))).toBe(site.adminHref("/templates"));
		expect(href(t("sidebar.events"))).toBe(site.adminHref("/events"));
		expect(href(t("sidebar.apiKeys"))).toBe(site.adminHref("/api-keys"));
		expect(href("Tools page")).toBe(site.adminHref("/tools/tools"));
		expect(href("More page")).toBe(site.adminHref("/tools/more"));
		// Settings opens at its first tab, which the page redirects to.
		expect(href(t("sidebar.settings"))).toBe(site.adminHref("/settings"));
	});

	it("leaves Templates out when the site turns them off", () => {
		const off = createSite({ ...testConfig, admin: { ...testConfig.admin, templates: false } } as CmsConfig);
		renderSidebar({}, off);
		expect(screen.queryByRole("link", { name: t("sidebar.templates") })).toBeNull();
	});

	it("marks the screen that is open", () => {
		window.localStorage.clear();
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
		openSite();
		const badge = t("sidebar.eventsBadge", { count: 4 });
		expect(within(menu(t("sidebar.site"))).getByLabelText(badge)).toBeTruthy();
		expect(within(menu(t("sidebar.settings"))).queryByLabelText(badge)).toBeNull();
		expect(screen.getAllByLabelText(badge)).toHaveLength(1);
		cleanup();
		renderSidebar({ eventsCount: 0 });
		expect(screen.queryByLabelText(/failed event deliveries/)).toBeNull();
	});

	it("shows the failure count on the collapsed Site header so problems stay visible", () => {
		window.localStorage.clear();
		renderSidebar({ eventsCount: 4 });
		const badge = t("sidebar.eventsBadge", { count: 4 });
		expect(within(siteGroup()).getByLabelText(badge)).toBeTruthy();
		fireEvent.click(siteGroup());
		// Open, the count moves onto the Event log item itself.
		expect(within(siteGroup()).queryByLabelText(badge)).toBeNull();
		expect(screen.getAllByLabelText(badge)).toHaveLength(1);
	});

	it("keeps the trash count badge on Trash", () => {
		renderSidebar({ trashCount: 7 });
		expect(within(menu(t("sidebar.trash"))).getByLabelText(t("sidebar.trashBadge", { count: 7 }))).toBeTruthy();
	});
});

describe("folder tree under a collection", () => {
	const name = site.COLLECTION_DEFINITIONS[site.DEFAULT_COLLECTION].label;
	const tree = () => screen.getByRole("list", { name: t("sidebar.folderTree", { label: name }) });

	it("opens under the active collection: the folders, nested ones when expanded", () => {
		const folders = [folder("a", "Dev"), folder("b", "Essays"), folder("c", "Next.js", "a")];
		renderSidebar({ folderNav: folderNav(folders, { currentFolder: "c" }) });
		const rows = within(tree())
			.getAllByRole("button")
			.map((button) => button.textContent?.trim())
			.filter(Boolean);
		expect(rows).toEqual(["Dev", "Next.js", "Essays"]);
		// Under the collection entry, before the next collection.
		const content = menu(t("sidebar.content"));
		const order = [...content.querySelectorAll("a, ul[aria-label]")].map((node) => node.textContent?.trim() ?? "");
		expect(order.findIndex((text) => text.includes("Dev"))).toBeGreaterThan(order.indexOf(name));
	});

	it("hides the subfolders of a collapsed folder, and the chevron opens them", () => {
		const folders = [folder("a", "Dev"), folder("c", "Next.js", "a")];
		renderSidebar({ folderNav: folderNav(folders) });
		expect(within(tree()).queryByText("Next.js")).toBeNull();
		fireEvent.click(within(tree()).getByRole("button", { name: t("sidebar.folderExpand", { name: "Dev" }) }));
		expect(within(tree()).getByText("Next.js")).toBeTruthy();
	});

	it("selects a folder, and selects all on collection link", () => {
		const nav = folderNav([folder("a", "Dev")]);
		renderSidebar({ folderNav: nav });
		fireEvent.click(within(tree()).getByRole("button", { name: "Dev" }));
		expect(nav.onSelectFolder).toHaveBeenCalledWith("a");
		fireEvent.click(screen.getByRole("link", { name }));
		expect(nav.onSelectFolder).toHaveBeenCalledWith("all");
		expect(within(tree()).queryByRole("button", { name: tc("addFolder") })).toBeNull();
	});

	it("marks the open folder", () => {
		renderSidebar({ folderNav: folderNav([folder("a", "Dev")], { currentFolder: "a" }) });
		expect(within(tree()).getByRole("button", { name: "Dev" }).getAttribute("aria-current")).toBe("true");
	});

	it("shows a chevron only on a collection that has folders", () => {
		const second =
			site.COLLECTIONS.find(
				(c) => site.COLLECTION_DEFINITIONS[c].folders ?? site.COLLECTION_DEFINITIONS[c].kind !== "item",
			) ?? site.COLLECTIONS[1];
		const first = site.COLLECTIONS.find((c) => c !== second) ?? site.COLLECTIONS[0];
		renderSidebar({ activeNav: first as string, folderCounts: { [second as string]: 2 } });
		const row = (collection: string) =>
			screen.getByRole("link", { name: site.COLLECTION_DEFINITIONS[collection as typeof first].label });
		expect(row(second as string).querySelector("svg.lucide-chevron-right")).not.toBeNull();
		expect(row(first as string).querySelector("svg[class*=chevron]")).toBeNull();
	});

	it("gives the open collection's tree its own fold button, and folds the tree away with it", () => {
		renderSidebar({ folderNav: folderNav([folder("a", "Dev")]) });
		expect(screen.getByRole("link", { name }).querySelector("svg[class*=chevron]")).toBeNull();
		const fold = screen.getByRole("button", { name: t("sidebar.hideFolders") });
		expect(fold.getAttribute("aria-expanded")).toBe("true");
		fireEvent.click(fold);
		expect(screen.queryByRole("list", { name: t("sidebar.folderTree", { label: name }) })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: t("sidebar.showFolders") }));
		expect(tree()).toBeTruthy();
	});

	it("does not render tree when the open collection has no folders", () => {
		renderSidebar({ folderNav: folderNav([]) });
		expect(screen.queryByRole("list", { name: t("sidebar.folderTree", { label: name }) })).toBeNull();
		expect(screen.getByRole("link", { name }).querySelector("svg[class*=chevron]")).toBeNull();
	});

	it("draws no tree and no chevron for an open collection whose folders are off, even with a stale count", () => {
		const off = siteWithFolders(site.DEFAULT_COLLECTION, false);
		const label = off.COLLECTION_DEFINITIONS[off.DEFAULT_COLLECTION].label;
		renderSidebar({ activeNav: off.DEFAULT_COLLECTION }, off);
		expect(screen.queryByRole("list", { name: t("sidebar.folderTree", { label }) })).toBeNull();
		expect(screen.getByRole("link", { name: label }).querySelector("svg[class*=chevron]")).toBeNull();
		cleanup();
		const on = siteWithFolders(site.DEFAULT_COLLECTION, true);
		renderSidebar({ activeNav: on.DEFAULT_COLLECTION, folderNav: folderNav([folder("a", "Dev")]) }, on);
		expect(screen.getByRole("list", { name: t("sidebar.folderTree", { label }) })).toBeTruthy();
	});

	it("leaves no empty row under an open collection that has no folders", () => {
		const on = siteWithFolders(site.DEFAULT_COLLECTION, true);
		const { container } = renderSidebar({ activeNav: on.DEFAULT_COLLECTION, folderNav: folderNav([]) }, on);
		const items = container.querySelectorAll('[data-sidebar="menu-item"]');
		expect(Array.from(items).filter((item) => item.children.length === 0)).toEqual([]);
	});

	it("provides context menu with subfolder create, rename, and delete without + Add folder button", () => {
		const nav = folderNav([folder("a", "Dev")]);
		renderSidebar({ folderNav: nav });
		expect(within(tree()).queryByRole("button", { name: tc("addFolder") })).toBeNull();
		const moreBtn = screen.getByRole("button", { name: t("list.folderActions", { name: "Dev" }) });
		expect(moreBtn).toBeTruthy();
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

describe("media folder tree in sidebar", () => {
	const mediaTree = () => screen.getByRole("list", { name: t("sidebar.folderTree", { label: t("sidebar.media") }) });

	it("does not offer + Add folder button or includeDescendants toggle", () => {
		const nav = folderNav([folder("m1", "Images")], { collection: "media" });
		renderSidebar({ activeNav: "media", folderNav: nav });
		expect(within(mediaTree()).queryByRole("button", { name: tc("addFolder") })).toBeNull();
		expect(screen.queryByRole("checkbox")).toBeNull();
		expect(screen.queryByRole("switch")).toBeNull();
	});

	it("handles inline rename with Enter and Escape", () => {
		const f = folder("m1", "Images");
		const nav = folderNav([f], { collection: "media" });
		renderSidebar({ activeNav: "media", folderNav: nav });
		const folderBtn = within(mediaTree()).getByRole("button", { name: "Images" });
		fireEvent.keyDown(folderBtn, { key: "F2" });
		const input = within(mediaTree()).getByRole("textbox");
		expect(input).toBeDefined();

		// Escape cancels rename
		fireEvent.keyDown(input, { key: "Escape" });
		expect(within(mediaTree()).queryByRole("textbox")).toBeNull();

		// F2 again and Enter commits rename
		const folderBtnAgain = within(mediaTree()).getByRole("button", { name: "Images" });
		fireEvent.keyDown(folderBtnAgain, { key: "F2" });
		const inputAgain = within(mediaTree()).getByRole("textbox");
		fireEvent.change(inputAgain, { target: { value: "Photos" } });
		fireEvent.keyDown(inputAgain, { key: "Enter" });
		expect(nav.folderActions.renameFolderDirect).toHaveBeenCalledWith(f, "Photos");
	});
});
