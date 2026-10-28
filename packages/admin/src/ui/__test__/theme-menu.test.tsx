import { cleanup, fireEvent, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { renderWithSite } from "../../test/site";
import { uiMessages } from "../messages";
import { THEME_MODES, ThemeMenu, themeMode } from "../theme-menu";

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

const renderMenu = () =>
	renderWithSite(
		<ThemeProvider attribute="class" storageKey={KEY}>
			<ThemeMenu />
		</ThemeProvider>,
	);
const open = () => fireEvent.click(screen.getByRole("button", { name: t("theme.label") }));
const radio = (mode: (typeof THEME_MODES)[number]) => screen.getByRole("menuitemradio", { name: t(`theme.${mode}`) });

describe("the screen mode menu", () => {
	it("is one button named for the screen mode, and opens the three modes with the current one checked", async () => {
		renderMenu();
		open();
		await screen.findByRole("menu");
		expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(
			THEME_MODES.map((mode) => t(`theme.${mode}`)),
		);
		// The system is followed until a mode is picked.
		expect(radio("system").getAttribute("aria-checked")).toBe("true");
		expect(radio("light").getAttribute("aria-checked")).toBe("false");
	});

	it("picks each mode and keeps it in this browser", async () => {
		for (const mode of THEME_MODES) {
			window.localStorage.clear();
			const view = renderMenu();
			open();
			await screen.findByRole("menu");
			fireEvent.click(radio(mode));
			await vi.waitFor(() => expect(window.localStorage.getItem(KEY)).toBe(mode));
			view.unmount();
		}
	});

	it("starts at the mode that is stored", async () => {
		window.localStorage.setItem(KEY, "dark");
		renderMenu();
		open();
		await screen.findByRole("menu");
		expect(radio("dark").getAttribute("aria-checked")).toBe("true");
	});
});

describe("the mode a stored theme means", () => {
	it("is light or dark as stored, and the system for anything else", () => {
		expect(themeMode("light")).toBe("light");
		expect(themeMode("dark")).toBe("dark");
		for (const stored of ["system", undefined, "", "sepia"]) expect(themeMode(stored)).toBe("system");
	});
});
