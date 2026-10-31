import { describe, expect, it } from "vitest";
import { gitignoreCoverage, hasSuppressHydrationWarning, montiNextFilePath, montiNextFiles } from "../next-app";

describe("suppressHydrationWarning on <html>", () => {

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
