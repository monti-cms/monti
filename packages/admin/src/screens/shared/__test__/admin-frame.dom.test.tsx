import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { fakeApi } from "../../../test/fake-api";
import { createTestRouter } from "../../../test/router";
import { AdminUiLabels } from "../../../ui/labels";
import { AdminFrame } from "../admin-frame";
import { AdminQueryProvider } from "../query-provider";
import { DockedPanel } from "../side-panel";

const { render } = createTestRouter();

beforeEach(() => {
	window.localStorage.clear();
	fakeApi().withEmptyRail().install();
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

describe("the side panel dock", () => {
	beforeEach(() => stubWidth(false));

	it("PLUG-A5 draws a panel that a screen opens outside that screen, beside the whole page, and takes it away when the screen closes it", () => {
		const view = (open: boolean) => (
			<AdminQueryProvider>
				<AdminUiLabels>
					<AdminFrame sidebar={{ activeNav: testSite.DEFAULT_COLLECTION }}>
						<section aria-label="Page">
							{open && (
								<DockedPanel>
									<aside aria-label="Record" />
								</DockedPanel>
							)}
						</section>
					</AdminFrame>
				</AdminUiLabels>
			</AdminQueryProvider>
		);
		const shown = render(view(true));
		const page = screen.getByRole("region", { name: "Page" });
		expect(within(page).queryByRole("complementary", { name: "Record" })).toBeNull();
		// Both the page and the panel are in the area beside the rail.
		const main = within(screen.getByRole("main"));
		expect(main.getByRole("region", { name: "Page" })).toBe(page);
		expect(main.getByRole("complementary", { name: "Record" })).toBeInTheDocument();
		shown.rerender(view(false));
		expect(screen.queryByRole("complementary", { name: "Record" })).toBeNull();
	});
});
