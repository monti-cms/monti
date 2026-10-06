import { act, render } from "@testing-library/react";
import { useTheme } from "next-themes";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ADMIN_THEME_STORAGE_KEY, AdminThemeProvider } from "../admin-theme-provider";

const SITE_THEME_KEY = "theme";
const html = document.documentElement;

// next-themes reads matchMedia for the system theme; jsdom does not provide it.
if (!window.matchMedia) {
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
		onchange: null,
	})) as typeof window.matchMedia;
}

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	html.className = "";
	html.removeAttribute("style");
	localStorage.clear();
	delete (window as unknown as Record<string, unknown>).__montiAdminHtmlBefore;
});

function SetThemeButton({ to }: { to: string }) {
	const { setTheme } = useTheme();
	return (
		<button type="button" onClick={() => setTheme(to)}>
			set
		</button>
	);
}

describe("AdminThemeProvider", () => {
	it("keeps the admin theme under its own key and leaves the site's theme key alone", () => {
		localStorage.setItem(SITE_THEME_KEY, "light");
		const { getByText } = render(
			<AdminThemeProvider>
				<SetThemeButton to="dark" />
			</AdminThemeProvider>,
		);
		act(() => getByText("set").click());
		expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("dark");
		expect(localStorage.getItem(SITE_THEME_KEY)).toBe("light");
		expect(ADMIN_THEME_STORAGE_KEY).not.toBe(SITE_THEME_KEY);
	});

	it("stores the admin theme under the key the site picks", () => {
		const { getByText } = render(
			<AdminThemeProvider storageKey="my-admin-theme">
				<SetThemeButton to="dark" />
			</AdminThemeProvider>,
		);
		act(() => getByText("set").click());
		expect(localStorage.getItem("my-admin-theme")).toBe("dark");
		expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBeNull();
	});

	it("leaves the site's own dark class and color-scheme in place when the admin unmounts", () => {
		html.classList.add("site-font", "dark");
		html.style.colorScheme = "dark";
		const { unmount } = render(
			<AdminThemeProvider>
				<div />
			</AdminThemeProvider>,
		);
		unmount();
		expect(html.classList.contains("dark")).toBe(true);
		expect(html.style.colorScheme).toBe("dark");
		expect(html.classList.contains("site-font")).toBe(true);
	});

	it("removes the admin's dark class and color-scheme again when the site had none", () => {
		localStorage.setItem(ADMIN_THEME_STORAGE_KEY, "dark");
		html.classList.add("site-font");
		const { unmount } = render(
			<AdminThemeProvider>
				<div />
			</AdminThemeProvider>,
		);
		// The admin applied its own theme while mounted.
		expect(html.classList.contains("dark")).toBe(true);
		unmount();
		expect(html.classList.contains("dark")).toBe(false);
		expect(html.style.colorScheme).toBe("");
		expect(html.classList.contains("site-font")).toBe(true);
	});

	it("restores the state recorded before the admin theme script ran on a full page load", () => {
		// The inline script in the server HTML recorded the site's dark theme; by hydration the admin's light theme is on `html`.
		(window as unknown as Record<string, unknown>).__montiAdminHtmlBefore = {
			dark: true,
			light: false,
			colorScheme: "dark",
		};
		localStorage.setItem(ADMIN_THEME_STORAGE_KEY, "light");
		const { unmount } = render(
			<AdminThemeProvider>
				<div />
			</AdminThemeProvider>,
		);
		expect(html.classList.contains("dark")).toBe(false);
		unmount();
		expect(html.classList.contains("dark")).toBe(true);
		expect(html.style.colorScheme).toBe("dark");
	});
});
