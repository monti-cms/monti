import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminThemeProvider } from "../admin-theme-provider";

afterEach(() => {
	document.documentElement.className = "";
	document.documentElement.removeAttribute("style");
});

describe("AdminThemeProvider", () => {
	it("removes the leftover dark class and color-scheme from html when leaving the admin", () => {
		document.documentElement.classList.add("site-font");
		const { unmount } = render(
			<AdminThemeProvider>
				<div />
			</AdminThemeProvider>,
		);
		document.documentElement.classList.add("dark");
		document.documentElement.style.colorScheme = "dark";
		unmount();
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(document.documentElement.style.colorScheme).toBe("");
		// Other classes added by the site are left alone.
		expect(document.documentElement.classList.contains("site-font")).toBe(true);
	});
});
