import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { PanelRight } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { preferenceKey } from "../../../lib/utils/site-storage";
import type { AdminPanel } from "../../../plugins";
import { createTestRouter } from "../../../test/router";
import { AdminShell } from "../admin-shell";
import { AdminQueryProvider } from "../query-provider";
import { ScreenContextProvider, useScreenContext } from "../screen-context";
import { AdminPanelProvider, SIDE_PANEL_SHORTCUT_KEY } from "../side-panel-slot";

const { render } = createTestRouter();

/** The panel of a plugin: it prints where the admin is, as the plugin's own component would read it. */
function Where() {
	return <output aria-label="where">{JSON.stringify(useScreenContext())}</output>;
}
const PANEL: AdminPanel = { label: "Helper", icon: PanelRight, Component: Where };

const whereIs = () => JSON.parse(screen.getByLabelText("where").textContent ?? "{}");
const toggle = () => screen.getByRole("button", { name: /Helper/ });

/** A shell page with the plugin's panel, the way the plugin scope puts it around the admin. */
const renderShell = (
	activeNav: Parameters<typeof AdminShell>[0]["sidebar"]["activeNav"],
	panel: AdminPanel | null = PANEL,
) => {
	const page = (
		<AdminQueryProvider>
			<AdminShell title="Page" sidebar={{ activeNav }}>
				<p>page body</p>
			</AdminShell>
		</AdminQueryProvider>
	);
	return render(
		<ScreenContextProvider>
			{panel ? <AdminPanelProvider panel={panel}>{page}</AdminPanelProvider> : page}
		</ScreenContextProvider>,
	);
};

/** Makes the window narrow (or wide) for `matchMedia`, which jsdom does not have. */
const stubWidth = (narrow: boolean) =>
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: narrow && query.includes("max-width"),
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));

beforeEach(() => {
	window.localStorage.clear();
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) })),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("side panel in the admin shell", () => {
	it("has no button and no pane when no plugin declares a panel", () => {
		renderShell("media", null);
		expect(screen.queryByRole("button", { name: /Helper/ })).toBeNull();
		expect(screen.queryByRole("complementary")).toBeNull();
	});

	it("opens and closes from the button in the header, and the pane shows the plugin's component", () => {
		renderShell("media");
		expect(screen.queryByRole("complementary")).toBeNull();
		fireEvent.click(toggle());
		expect(screen.getByRole("complementary", { name: "Helper" })).toBeTruthy();
		expect(screen.getByLabelText("where")).toBeTruthy();
		fireEvent.click(toggle());
		expect(screen.queryByRole("complementary")).toBeNull();
	});

	it("remembers whether it is open for the next screen", () => {
		const first = renderShell("media");
		fireEvent.click(toggle());
		first.unmount();
		renderShell("settings");
		expect(screen.getByRole("complementary", { name: "Helper" })).toBeTruthy();
		fireEvent.click(toggle());
		cleanup();
		renderShell("media");
		expect(screen.queryByRole("complementary")).toBeNull();
	});

	it("opens and closes with the keyboard shortcut, and leaves other keys alone", () => {
		renderShell("media");
		fireEvent.keyDown(window, { key: SIDE_PANEL_SHORTCUT_KEY });
		expect(screen.queryByRole("complementary")).toBeNull();
		fireEvent.keyDown(window, { key: SIDE_PANEL_SHORTCUT_KEY, ctrlKey: true });
		expect(screen.getByRole("complementary")).toBeTruthy();
		fireEvent.keyDown(window, { key: SIDE_PANEL_SHORTCUT_KEY, metaKey: true });
		expect(screen.queryByRole("complementary")).toBeNull();
	});

	it("docks beside the page from 1280px wide, and is a sheet below that, so the page keeps room", async () => {
		const windowOf = (width: number) =>
			vi.stubGlobal("matchMedia", (query: string) => ({
				matches: width <= Number(/max-width: (\d+)px/.exec(query)?.[1] ?? -1),
				media: query,
				addEventListener: () => undefined,
				removeEventListener: () => undefined,
			}));
		windowOf(1280);
		const wide = renderShell("media");
		fireEvent.click(toggle());
		expect(screen.getByRole("complementary", { name: "Helper" })).toBeTruthy();
		wide.unmount();
		window.localStorage.clear();
		windowOf(1279);
		renderShell("media");
		fireEvent.click(toggle());
		expect(await screen.findByRole("dialog", { name: "Helper" })).toBeTruthy();
		expect(screen.queryByRole("complementary")).toBeNull();
	});

	it("is a sheet on a narrow screen, closed on load even when the wide screen left it open", async () => {
		window.localStorage.setItem(preferenceKey(testSite, "side-panel"), "1");
		stubWidth(true);
		renderShell("media");
		expect(screen.queryByRole("dialog")).toBeNull();
		fireEvent.click(toggle());
		expect(await screen.findByRole("dialog", { name: "Helper" })).toBeTruthy();
		expect(screen.queryByRole("complementary")).toBeNull();
		expect(screen.getByLabelText("where")).toBeTruthy();
	});
});

describe("screen context of the shell pages", () => {
	const open = (activeNav: Parameters<typeof renderShell>[0]) => {
		// A panel left open on the last screen would be closed by the click.
		window.localStorage.clear();
		renderShell(activeNav);
		fireEvent.click(toggle());
		return whereIs();
	};

	it("names the collection on a list", () => {
		expect(open("post")).toEqual({ screen: "entries", collection: "post" });
	});

	it("names the media screen and the settings screen", () => {
		expect(open("media")).toEqual({ screen: "media" });
		cleanup();
		expect(open("settings")).toEqual({ screen: "settings" });
	});

	it("takes the trash for a list of entries, and every other page for `other`", () => {
		expect(open("trash")).toEqual({ screen: "entries" });
		cleanup();
		expect(open("events")).toEqual({ screen: "other" });
		cleanup();
		expect(open("tools:ai")).toEqual({ screen: "other" });
	});

	it("follows the screen it is published by: leaving a screen takes its values away", async () => {
		const first = renderShell("post");
		fireEvent.click(toggle());
		expect(whereIs().collection).toBe("post");
		first.rerender(
			<ScreenContextProvider>
				<AdminPanelProvider panel={PANEL}>
					<AdminQueryProvider>
						<AdminShell title="Page" sidebar={{ activeNav: "media" }}>
							<p>page body</p>
						</AdminShell>
					</AdminQueryProvider>
				</AdminPanelProvider>
			</ScreenContextProvider>,
		);
		await waitFor(() => expect(whereIs()).toEqual({ screen: "media" }));
	});
});
