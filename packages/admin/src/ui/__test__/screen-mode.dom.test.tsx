import { SidebarProvider } from "@monti-cms/ui";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { renderWithSite } from "../../test/site";
import { uiMessages } from "../messages";
import { ScreenModeSwitch, THEME_MODES, themeMode } from "../screen-mode";

const t = testSite.createTranslator(uiMessages);
const KEY = "monti-admin-theme";

beforeEach(() => {
	window.localStorage.clear();
	// next-themes reads the system preference through `matchMedia`, which jsdom does not have.
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
	}));
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderSwitch = ({ rail = false } = {}) =>
	renderWithSite(
		<ThemeProvider attribute="class" storageKey={KEY}>
			<SidebarProvider rail={rail}>
				<ScreenModeSwitch />
			</SidebarProvider>
		</ThemeProvider>,
	);
const cell = (mode: (typeof THEME_MODES)[number]) => screen.getByRole("button", { name: t(`theme.${mode}`) });
const radio = (mode: (typeof THEME_MODES)[number]) => screen.getByRole("menuitemradio", { name: t(`theme.${mode}`) });

describe("the screen mode", () => {
	it("offers the three modes at once, the system pressed until one is picked", () => {
		renderSwitch();
		expect(screen.getByRole("group", { name: t("theme.label") })).toBeInTheDocument();
		expect(cell("system").getAttribute("aria-pressed")).toBe("true");
		expect(cell("light").getAttribute("aria-pressed")).toBe("false");
	});

	it("picks each mode with one press and keeps it in this browser", async () => {
		renderSwitch();
		for (const mode of ["dark", "light", "system"] as const) {
			fireEvent.click(cell(mode));
			await vi.waitFor(() => expect(window.localStorage.getItem(KEY)).toBe(mode));
			expect(cell(mode).getAttribute("aria-pressed")).toBe("true");
		}
	});

	it("starts at the mode that is stored", () => {
		window.localStorage.setItem(KEY, "dark");
		renderSwitch();
		expect(cell("dark").getAttribute("aria-pressed")).toBe("true");
	});

	it("is one button on the folded rail, which opens the three modes with the current one checked", async () => {
		window.localStorage.setItem(KEY, "light");
		renderSwitch({ rail: true });
		fireEvent.click(screen.getByRole("button", { name: t("theme.label") }));
		await screen.findByRole("menu");
		expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(
			THEME_MODES.map((mode) => t(`theme.${mode}`)),
		);
		expect(radio("light").getAttribute("aria-checked")).toBe("true");
		fireEvent.click(radio("dark"));
		await vi.waitFor(() => expect(window.localStorage.getItem(KEY)).toBe("dark"));
	});
});

describe("the mode a stored theme means", () => {
	it("is light or dark as stored, and the system for anything else", () => {
		expect(themeMode("light")).toBe("light");
		expect(themeMode("dark")).toBe("dark");
		for (const stored of ["system", undefined, "", "sepia"]) expect(themeMode(stored)).toBe("system");
	});
});
