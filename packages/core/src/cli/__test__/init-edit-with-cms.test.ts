import { describe, expect, it } from "vitest";
import { wrapNextConfig } from "../init-edit";
import { usesWithCms } from "../next-app";

const WRAPPED =
	'import { withCms } from "@monti-cms/nextjs/config";\nconst nextConfig = {};\nexport default withCms(nextConfig);\n';

describe("usesWithCms", () => {
	it("is true for an import of withCms that is called", () => {
		expect(usesWithCms(WRAPPED)).toBe(true);
		expect(usesWithCms('import { withCms } from "@monti-cms/nextjs";\nexport default withCms({});\n')).toBe(true);
		expect(
			usesWithCms('const { withCms } = require("@monti-cms/nextjs/config");\nmodule.exports = withCms({});\n'),
		).toBe(true);
	});

	it("is false when the name only appears in a comment or a string", () => {
		expect(usesWithCms("// TODO: wrap this in withCms(nextConfig)\nexport default {};\n")).toBe(false);
		expect(
			usesWithCms("/* import { withCms } from '@monti-cms/nextjs/config'; withCms({}) */\nexport default {};\n"),
		).toBe(false);
		expect(usesWithCms('export default { note: "withCms(" };\n')).toBe(false);
	});

	it("is false for an import that is never called, or a call of another withCms", () => {
		expect(usesWithCms('import { withCms } from "@monti-cms/nextjs/config";\nexport default {};\n')).toBe(false);
		expect(usesWithCms('import { withCms } from "./my-wrapper";\nexport default withCms({});\n')).toBe(false);
	});
});

describe("wrapNextConfig on a file that only mentions withCms", () => {
	it("still wraps the export, adding the import once", () => {
		const result = wrapNextConfig(
			"next.config.ts",
			"// wrap with withCms later\nconst nextConfig = {};\nexport default nextConfig;\n",
		);
		expect(result.status).toBe("edit");
		if (result.status !== "edit") return;
		expect(result.text).toContain("export default withCms(nextConfig);");
		expect(result.text.match(/import \{ withCms \}/g)).toHaveLength(1);
	});

	it("leaves a wrapped file alone", () => {
		expect(wrapNextConfig("next.config.ts", WRAPPED)).toEqual({ status: "present" });
	});
});
