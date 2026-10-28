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

describe("the admin frame", () => {
	it("shows the rail next to the page on a wide screen, with no button to fold it away", () => {
		stubWidth(false);
		renderFrame();
		const rail = screen.getByRole("navigation", { name: t("sidebar.label") });
		expect(within(rail).getAllByRole("link").length).toBeGreaterThan(0);
		expect(screen.getByRole("heading", { level: 1, name: "Page" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: /sidebar/i })).toBeNull();
		fireEvent.keyDown(window, { key: "b", metaKey: true });
		expect(screen.getByRole("navigation", { name: t("sidebar.label") })).toBeTruthy();
	});

	it("keeps the rail in a drawer on a narrow screen: a button opens it, and choosing a row closes it", () => {
		stubWidth(true);
		renderFrame();
		expect(screen.queryByRole("navigation", { name: t("sidebar.label") })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: tui("sidebar.toggle") }));
		const rail = screen.getByRole("navigation", { name: t("sidebar.label") });
		fireEvent.click(within(rail).getByRole("link", { name: t("sidebar.trash") }));
		expect(screen.queryByRole("navigation", { name: t("sidebar.label") })).toBeNull();
	});
});
