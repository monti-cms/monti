import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContentFont } from "../content-font";

const root = document.documentElement;

afterEach(() => {
	root.style.removeProperty("--monti-content-font");
	root.style.removeProperty("--monti-content-mono-font");
	document.body.style.fontFamily = "";
	document.getElementById("site-code")?.remove();
});

describe("ContentFont", () => {
	it("copies the site's body and code fonts for the writing area, and clears them on unmount", () => {
		document.body.style.fontFamily = "Site Sans";
		const style = document.createElement("style");
		style.id = "site-code";
		style.textContent = "code { font-family: 'Site Mono'; }";
		document.head.append(style);
		const { unmount } = render(<ContentFont />);
		expect(root.style.getPropertyValue("--monti-content-font")).toContain("Site Sans");
		expect(root.style.getPropertyValue("--monti-content-mono-font")).toContain("Site Mono");
		expect(document.body.querySelector("code")).toBeNull();
		unmount();
		expect(root.style.getPropertyValue("--monti-content-mono-font")).toBe("");
	});

	it("keeps a value the site set itself", () => {
		root.style.setProperty("--monti-content-mono-font", "Chosen Mono");
		const { unmount } = render(<ContentFont />);
		unmount();
		expect(root.style.getPropertyValue("--monti-content-mono-font")).toBe("Chosen Mono");
	});
});
