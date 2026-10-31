import { type CmsConfig, definePlugin } from "@monti-cms/core";
import type { Folder } from "@monti-cms/core/site";
import { createSite } from "@monti-cms/core/site";
import { SidebarProvider } from "@monti-cms/ui";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import { renderInRouter } from "../../test/router";
import { withSite } from "../../test/site";
import { AdminUiLabels } from "../../ui/labels";
import { AdminSidebar, type AdminSidebarProps, type FolderNavigation } from "../admin-sidebar";
import { screensMessages } from "../messages";
import { ENTRY_DRAG_TYPE } from "../shared/entry-drag";

afterEach(cleanup);

const t = testSite.createTranslator(screensMessages);
const site = createSite({
	...testConfig,
	plugins: [definePlugin({ name: "stats", options: {}, nav: [{ path: "stats", label: "Post stats" }] })],
} as CmsConfig);

const renderRail = (props: Partial<AdminSidebarProps> = {}, target = site) =>
	renderInRouter(
		withSite(
			<AdminUiLabels>
				<SidebarProvider>
					<AdminSidebar activeNav={target.DEFAULT_COLLECTION} {...props} />
				</SidebarProvider>
			</AdminUiLabels>,
			target,
		),
	);
const rail = () => screen.getByRole("navigation", { name: t("sidebar.label") });
const link = (name: string | RegExp) => within(rail()).getByRole("link", { name });
const labelOf = (collection: string) => site.COLLECTION_DEFINITIONS[collection as typeof site.DEFAULT_COLLECTION].label;

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
	onSelectFolder: vi.fn(),
	onDropEntries: vi.fn(),
	...overrides,
});

describe("moving around by the rail", () => {
	it("EVENT-F1 counts the failed deliveries on the tools row, and only while there are some", () => {
		renderRail({ eventsCount: 4 });
		const badge = t("sidebar.eventsBadge", { count: 4 });
		expect(within(link(new RegExp(t("sidebar.tools")))).getByLabelText(badge)).toBeInTheDocument();
		expect(within(rail()).getAllByLabelText(badge)).toHaveLength(1);
		cleanup();
		renderRail({ eventsCount: 0 });
		expect(within(rail()).queryByLabelText(t("sidebar.eventsBadge", { count: 0 }))).toBeNull();
	});
});

describe("folders in the rail", () => {
	const name = labelOf(site.DEFAULT_COLLECTION);
	const tree = () => screen.getByRole("list", { name: t("sidebar.folderTree", { label: name }) });
	const rows = () =>
		within(tree())
			.getAllByRole("button")
			.map((button) => button.textContent?.trim());

	it("opens under the open collection, with the folders on the open path", () => {
		const folders = [folder("a", "Dev"), folder("b", "Essays"), folder("c", "Next.js", "a")];
		renderRail({ folderNav: folderNav(folders, { currentFolder: "a" }) });
		expect(rows()).toEqual(["Dev", "Next.js", "Essays"]);
		const order = within(rail())
			.getAllByRole("link")
			.map((item) => item.textContent?.trim());
		expect(order).toContain(name);
		expect(tree().compareDocumentPosition(link(name)) & Node.DOCUMENT_POSITION_PRECEDING).toBe(
			Node.DOCUMENT_POSITION_PRECEDING,
		);
	});

	it("LIST-F6 selects a folder, and everything again from the collection row", () => {
		const nav = folderNav([folder("a", "Dev")]);
		renderRail({ folderNav: nav });
		fireEvent.click(within(tree()).getByRole("button", { name: "Dev" }));
		expect(nav.onSelectFolder).toHaveBeenCalledWith("a");
		fireEvent.click(link(name));
		expect(nav.onSelectFolder).toHaveBeenCalledWith("all");
	});

	it("LIST-C5 moves dropped entries into the folder they are dropped on", () => {
		const nav = folderNav([folder("a", "Dev")]);
		renderRail({ folderNav: nav });
		const entries = [{ id: "e1", expectedVersion: 3 }];
		const dataTransfer = { types: [ENTRY_DRAG_TYPE], getData: () => JSON.stringify(entries) };
		const row = within(tree()).getByRole("button", { name: "Dev" });
		fireEvent.dragOver(row, { dataTransfer });
		fireEvent.drop(row, { dataTransfer });
		expect(nav.onDropEntries).toHaveBeenCalledWith("a", entries);
	});

	it("MEDIA-B1 shows the media folders under media", () => {
		renderRail({ activeNav: "media", folderNav: folderNav([folder("m1", "Blog Assets")], { collection: "media" }) });
		const media = screen.getByRole("list", { name: t("sidebar.folderTree", { label: t("sidebar.media") }) });
		expect(within(media).getByRole("button", { name: "Blog Assets" })).toBeInTheDocument();
	});
});
