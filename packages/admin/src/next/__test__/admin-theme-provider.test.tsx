import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminThemeProvider } from "../admin-theme-provider";

afterEach(() => {
	document.documentElement.className = "";
	document.documentElement.removeAttribute("style");
});

describe("AdminThemeProvider", () => {
	it("관리자를 떠나면 html에 남은 dark 클래스와 color-scheme을 지운다", () => {
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
		// 사이트가 붙인 다른 클래스는 건드리지 않는다.
		expect(document.documentElement.classList.contains("site-font")).toBe(true);
	});
});
