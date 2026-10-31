import { RightPanelOpen } from "@carbon/icons-react";
import { SidePanel } from "@monti-cms/ui";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminPanel } from "../../../plugins";
import { fakeApi } from "../../../test/fake-api";
import { createTestRouter } from "../../../test/router";
import { AdminFrame } from "../admin-frame";
import { AdminQueryProvider } from "../query-provider";
import { ScreenContextProvider, useScreenContext } from "../screen-context";
import { AdminPanelProvider, SIDE_PANEL_SHORTCUT_KEY } from "../side-panel-slot";

const { render } = createTestRouter();

/** The panel of a plugin: a `SidePanel` that prints where the admin is, as the plugin's own component would read it. */
function Where({ onClose }: { onClose: () => void }) {
	return (
		<SidePanel title="Helper" onClose={onClose}>
			<output aria-label="where">{JSON.stringify(useScreenContext())}</output>
		</SidePanel>
	);
}
const PANEL: AdminPanel = { label: "Helper", icon: RightPanelOpen, Component: Where };

const whereIs = () => JSON.parse(screen.getByLabelText("where").textContent ?? "{}");
const toggle = () => screen.getByRole("button", { name: /Helper/ });

/** A shell page with the plugin's panel, the way the plugin scope puts it around the admin. */
const renderShell = (
	activeNav: Parameters<typeof AdminFrame>[0]["sidebar"]["activeNav"],
	panel: AdminPanel | null = PANEL,
) => {
	const page = (
		<AdminQueryProvider>
			<AdminFrame sidebar={{ activeNav }}>
				<p>page body</p>
			</AdminFrame>
		</AdminQueryProvider>
	);
	return render(
		<ScreenContextProvider>
			{panel ? <AdminPanelProvider panel={panel}>{page}</AdminPanelProvider> : page}
		</ScreenContextProvider>,
	);
};

beforeEach(() => {
	window.localStorage.clear();
	// The admin frame asks for its rail counts.
	fakeApi().withEmptyRail().install();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("side panel in the admin shell", () => {
	it("PLUG-A5 opens and closes from the button in the header, and the pane shows the plugin's component", () => {
		renderShell("media");
		expect(screen.queryByRole("complementary")).toBeNull();
		fireEvent.click(toggle());
		expect(screen.getByRole("complementary", { name: "Helper" })).toBeInTheDocument();
		expect(screen.getByLabelText("where")).toBeInTheDocument();
		fireEvent.click(toggle());
		expect(screen.queryByRole("complementary")).toBeNull();
	});

	it("opens and closes with the keyboard shortcut, and leaves other keys alone", () => {
		renderShell("media");
		fireEvent.keyDown(window, { key: SIDE_PANEL_SHORTCUT_KEY });
		expect(screen.queryByRole("complementary")).toBeNull();
		fireEvent.keyDown(window, { key: SIDE_PANEL_SHORTCUT_KEY, ctrlKey: true });
		expect(screen.getByRole("complementary")).toBeInTheDocument();
		fireEvent.keyDown(window, { key: SIDE_PANEL_SHORTCUT_KEY, metaKey: true });
		expect(screen.queryByRole("complementary")).toBeNull();
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
						<AdminFrame sidebar={{ activeNav: "media" }}>
							<p>page body</p>
						</AdminFrame>
					</AdminQueryProvider>
				</AdminPanelProvider>
			</ScreenContextProvider>,
		);
		await waitFor(() => expect(whereIs()).toEqual({ screen: "media" }));
	});
});
