import { describe, expect, it } from "vitest";
import { gitignoreCoverage, montiNextFilePath, montiNextFiles, usesWithCms } from "../next-app";

describe("suppressHydrationWarning on <html>", () => {
	it("INIT-K5 says what a .gitignore keeps out of git: .env.local and the .monti/ folder, in any of the usual spellings", () => {
		expect(gitignoreCoverage("node_modules\n")).toEqual({ envLocal: false, montiFolder: false });
		expect(gitignoreCoverage(".env*\n/.monti/\n")).toEqual({ envLocal: true, montiFolder: true });
		expect(gitignoreCoverage(".env.local\r\n.monti\r\n")).toEqual({ envLocal: true, montiFolder: true });
		expect(gitignoreCoverage(".env.local\n")).toEqual({ envLocal: true, montiFolder: false });
	});

	it("INIT-R2 lists the three Next files once: the layout and page under the admin path, the API route", () => {
		const files = montiNextFiles("/studio");
		expect(files.map((file) => montiNextFilePath("src/app", file))).toEqual([
			"src/app/studio/layout.tsx",
			"src/app/studio/[[...path]]/page.tsx",
			"src/app/api/monti/[...path]/route.ts",
		]);
		expect(files.map((file) => file.marker)).toEqual(["CmsAdminLayout", "CmsAdminPage", "createRouteHandler"]);
	});
});

describe("usesWithCms", () => {
	const WRAPPED =
		'import { withCms } from "@monti-cms/nextjs/config";\nconst nextConfig = {};\nexport default withCms(nextConfig);\n';

	it("INIT-K4 is true for an import of withCms that is called", () => {
		expect(usesWithCms(WRAPPED)).toBe(true);
		expect(usesWithCms('import { withCms } from "@monti-cms/nextjs";\nexport default withCms({});\n')).toBe(true);
		expect(
			usesWithCms('const { withCms } = require("@monti-cms/nextjs/config");\nmodule.exports = withCms({});\n'),
		).toBe(true);
	});

	it("INIT-K4 is false when the name only appears in a comment or a string", () => {
		expect(usesWithCms("// TODO: wrap this in withCms(nextConfig)\nexport default {};\n")).toBe(false);
		expect(
			usesWithCms("/* import { withCms } from '@monti-cms/nextjs/config'; withCms({}) */\nexport default {};\n"),
		).toBe(false);
		expect(usesWithCms('export default { note: "withCms(" };\n')).toBe(false);
	});

	it("INIT-K4 is false for an import that is never called, or a call of another withCms", () => {
		expect(usesWithCms('import { withCms } from "@monti-cms/nextjs/config";\nexport default {};\n')).toBe(false);
		expect(usesWithCms('import { withCms } from "./my-wrapper";\nexport default withCms({});\n')).toBe(false);
	});
});
