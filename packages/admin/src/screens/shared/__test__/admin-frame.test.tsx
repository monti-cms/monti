import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { jsonResponse } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { AdminUiLabels } from "../../../ui/labels";
import { uiMessages } from "../../../ui/messages";
import { screensMessages } from "../../messages";
import { AdminFrame } from "../admin-frame";
import { AdminQueryProvider } from "../query-provider";

const { render } = createTestRouter();
const t = testSite.createTranslator(screensMessages);
const tui = testSite.createTranslator(uiMessages);

beforeEach(() => {
	window.localStorage.clear();
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => jsonResponse({ items: [], total: 0, counts: { failed: 0, dead: 0 } })),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** Makes the window narrow (or wide) for `matchMedia`, which jsdom does not have. */
const stubWidth = (narrow: boolean) => {
	Object.defineProperty(window, "innerWidth", { value: narrow ? 500 : 1280, configurable: true });
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: narrow && query.includes("max-width"),
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
	}));
};

const renderFrame = () =>
	render(
		<AdminQueryProvider>
			<AdminUiLabels>
				<AdminFrame sidebar={{ activeNav: testSite.DEFAULT_COLLECTION }}>
					<h1>Page</h1>
				</AdminFrame>
			</AdminUiLabels>
		</AdminQueryProvider>,
	);

const rail = () => screen.getByRole("navigation", { name: t("sidebar.label") });
const fold = () => screen.getByRole("button", { name: tui("sidebar.fold") });
const unfold = () => screen.getByRole("button", { name: tui("sidebar.unfold") });
const siteName = () => within(rail()).queryByRole("link", { name: testSite.SITE_NAME || "CMS" });

describe("the admin frame", () => {
	it("shows the rail next to the page on a wide screen", () => {
		stubWidth(false);
		renderFrame();
		expect(within(rail()).getAllByRole("link").length).toBeGreaterThan(0);
		expect(screen.getByRole("heading", { level: 1, name: "Page" })).toBeTruthy();
	});

	it("keeps the rail in a drawer on a narrow screen: a button opens it, choosing a row closes it, and there is no fold", () => {
		stubWidth(true);
		renderFrame();
		expect(screen.queryByRole("navigation", { name: t("sidebar.label") })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: tui("sidebar.toggle") }));
		expect(screen.queryByRole("button", { name: tui("sidebar.fold") })).toBeNull();
		fireEvent.click(within(rail()).getByRole("link", { name: t("sidebar.trash") }));
		expect(screen.queryByRole("navigation", { name: t("sidebar.label") })).toBeNull();
	});
});

describe("folding the sidebar to its icons", () => {
	beforeEach(() => stubWidth(false));

	it("folds with the fold button and unfolds with the button that takes its place", () => {
		renderFrame();
		expect(siteName()).toBeTruthy();
		fireEvent.click(fold());
		expect(siteName()).toBeNull();
		expect(screen.queryByRole("button", { name: tui("sidebar.fold") })).toBeNull();
		// The rows stay, as icons.
		expect(within(rail()).getByRole("link", { name: t("sidebar.trash") })).toBeTruthy();
		fireEvent.click(unfold());
		expect(siteName()).toBeTruthy();
		expect(fold()).toBeTruthy();
	});

	it("folds and unfolds with ⌘B and Ctrl+B", () => {
		renderFrame();
		fireEvent.keyDown(window, { key: "b", metaKey: true });
		expect(siteName()).toBeNull();
		fireEvent.keyDown(window, { key: "b", ctrlKey: true });
		expect(siteName()).toBeTruthy();
		// Other keys, and ⌘B with a modifier added, leave it alone.
		fireEvent.keyDown(window, { key: "v", metaKey: true });
		fireEvent.keyDown(window, { key: "b", metaKey: true, shiftKey: true });
		expect(siteName()).toBeTruthy();
	});

	it("remembers the folded state in this browser", () => {
		const first = renderFrame();
		fireEvent.click(fold());
		first.unmount();
		renderFrame();
		expect(siteName()).toBeNull();
		fireEvent.click(unfold());
		cleanup();
		renderFrame();
		expect(siteName()).toBeTruthy();
	});

	it("names a folded row and its count in a tooltip", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse({ items: [], total: 0, counts: { failed: 2, dead: 1 } })),
		);
		renderFrame();
		fireEvent.click(fold());
		const tools = await within(rail()).findByRole("link", { name: new RegExp(t("sidebar.tools")) });
		fireEvent.pointerEnter(tools, { pointerType: "mouse" });
		fireEvent.mouseEnter(tools);
		fireEvent.pointerMove(tools, { pointerType: "mouse" });
		fireEvent.mouseMove(tools);
		const tip = await screen.findByText(`${t("sidebar.tools")} 3`);
		expect(tip.textContent).toContain(`${t("sidebar.tools")} 3`);
	});

	it("puts a dot on the tools icon while deliveries have failed, and none for the trash", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse({ items: [], total: 4, counts: { failed: 2, dead: 1 } })),
		);
		renderFrame();
		// Unfolded, the count is written; no dot yet.
		const badge = t("sidebar.eventsBadge", { count: 3 });
		const tools = () => within(rail()).getByRole("link", { name: new RegExp(t("sidebar.tools")) });
		await within(tools()).findByLabelText(badge);
		expect(within(tools()).queryByRole("img", { name: badge })).toBeNull();
		fireEvent.click(fold());
		expect(within(tools()).getByRole("img", { name: badge })).toBeTruthy();
		const trash = within(rail()).getByRole("link", { name: new RegExp(t("sidebar.trash")) });
		expect(within(trash).queryByRole("img")).toBeNull();
	});

	it("shows no folders while folded", () => {
		render(
			<AdminQueryProvider>
				<AdminUiLabels>
					<AdminFrame
						sidebar={{
							activeNav: testSite.DEFAULT_COLLECTION,
							folderNav: {
								collection: testSite.DEFAULT_COLLECTION,
								currentFolder: "all",
								folders: [
									{
										id: "a",
										collection: testSite.DEFAULT_COLLECTION,
										parentId: null,
										name: "Dev",
										position: 0,
										version: 1,
									},
								],
								onSelectFolder: () => undefined,
								onDropEntries: () => undefined,
							},
						}}
					>
						<h1>Page</h1>
					</AdminFrame>
				</AdminUiLabels>
			</AdminQueryProvider>,
		);
		expect(within(rail()).getByRole("button", { name: "Dev" })).toBeTruthy();
		fireEvent.click(fold());
		expect(within(rail()).queryByRole("button", { name: "Dev" })).toBeNull();
	});
});
