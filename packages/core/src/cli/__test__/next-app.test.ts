import { describe, expect, it } from "vitest";
import { gitignoreCoverage, hasSuppressHydrationWarning, montiNextFilePath, montiNextFiles } from "../next-app";

describe("suppressHydrationWarning on <html>", () => {
	it("is detected on the tag, also across several lines and with a className expression", () => {
		expect(hasSuppressHydrationWarning('<html lang="en">\n<body />\n</html>')).toBe(false);
		expect(hasSuppressHydrationWarning('<html lang="en" suppressHydrationWarning>')).toBe(true);
		expect(hasSuppressHydrationWarning("<html>")).toBe(false);
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the JSX source holds a template literal on purpose
		const multi = '<html\n  lang="en"\n  className={`${font.variable} antialiased`}\n  suppressHydrationWarning\n>';
		expect(hasSuppressHydrationWarning(multi)).toBe(true);
	});

	it("says nothing about a layout without <html>, and counts a deliberate false as missing", () => {
		expect(hasSuppressHydrationWarning("export default () => null")).toBeUndefined();
		expect(hasSuppressHydrationWarning("<html suppressHydrationWarning={false}>")).toBe(false);
	});

	it("INIT-K5 says what a .gitignore keeps out of git: .env.local and the .monti/ folder, in any of the usual spellings", () => {
		expect(gitignoreCoverage("node_modules\n")).toEqual({ envLocal: false, montiFolder: false });
		expect(gitignoreCoverage(".env*\n/.monti/\n")).toEqual({ envLocal: true, montiFolder: true });
		expect(gitignoreCoverage(".env.local\r\n.monti\r\n")).toEqual({ envLocal: true, montiFolder: true });
		expect(gitignoreCoverage(".env.local\n")).toEqual({ envLocal: true, montiFolder: false });
	});

	it("lists the three Next files once: the layout and page under the admin path, the API route", () => {
		const files = montiNextFiles("/studio");
		expect(files.map((file) => montiNextFilePath("src/app", file))).toEqual([
			"src/app/studio/layout.tsx",
			"src/app/studio/[[...path]]/page.tsx",
			"src/app/api/monti/[...path]/route.ts",
		]);
		expect(files.map((file) => file.marker)).toEqual(["CmsAdminLayout", "CmsAdminPage", "createRouteHandler"]);
	});
});
