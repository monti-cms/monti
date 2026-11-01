import { describe, expect, it } from "vitest";
import { addSuppressHydrationWarning, ignoreForMonti, wrapNextConfig } from "../init-edit";
import { CREATE_NEXT_APP_LAYOUT, DEFAULT_NEXT_CONFIG } from "./init-helpers";

describe("wrapNextConfig", () => {
	it("INIT-K4 wraps the export of the default create-next-app config and adds the import below the last import", () => {
		expect(wrapNextConfig("next.config.ts", DEFAULT_NEXT_CONFIG)).toEqual({
			status: "edit",
			text: DEFAULT_NEXT_CONFIG.replace(
				'import type { NextConfig } from "next";',
				'import type { NextConfig } from "next";\nimport { withCms } from "@monti-cms/nextjs/config";',
			).replace("export default nextConfig;", "export default withCms(nextConfig);"),
			change: expect.stringContaining("withCms"),
		});
	});

	it("INIT-K4 wraps an object export and a call export, and puts the import below the last import", () => {
		const object = `import path from "node:path";\n\nexport default {\n  reactStrictMode: true,\n  outputFileTracingRoot: path.join(process.cwd(), "}"),\n};\n`;
		expect(wrapNextConfig("next.config.mjs", object)).toMatchObject({
			status: "edit",
			text: `import path from "node:path";\nimport { withCms } from "@monti-cms/nextjs/config";\n\nexport default withCms({\n  reactStrictMode: true,\n  outputFileTracingRoot: path.join(process.cwd(), "}"),\n});\n`,
		});

		const call = `import type { NextConfig } from "next";\nimport bundleAnalyzer from "@next/bundle-analyzer";\n\nconst withAnalyzer = bundleAnalyzer({ enabled: true });\nconst config: NextConfig = {};\n\nexport default withAnalyzer(config) // done\n`;
		expect(wrapNextConfig("next.config.ts", call)).toMatchObject({
			status: "edit",
			text: `import type { NextConfig } from "next";\nimport bundleAnalyzer from "@next/bundle-analyzer";\nimport { withCms } from "@monti-cms/nextjs/config";\n\nconst withAnalyzer = bundleAnalyzer({ enabled: true });\nconst config: NextConfig = {};\n\nexport default withCms(withAnalyzer(config)) // done\n`,
		});
	});

	it.each([
		[
			"a function",
			`import type { NextConfig } from "next";\nexport default (phase: string): NextConfig => ({});\n`,
			"function",
		],
		[
			"satisfies",
			`import type { NextConfig } from "next";\nexport default { reactStrictMode: true } satisfies NextConfig;\n`,
			"satisfies",
		],
		["CommonJS", `module.exports = { reactStrictMode: true };\n`, "module.exports"],
	])("INIT-K4 leaves %s alone, and says why, naming the file", (_shape, text, why) => {
		expect(wrapNextConfig("next.config.ts", text)).toEqual({
			status: "manual",
			reason: expect.stringMatching(new RegExp(`next\\.config\\.ts.*${why}|${why}.*next\\.config\\.ts`)),
		});
	});
});

describe("addSuppressHydrationWarning", () => {
	it("INIT-K4 puts suppressHydrationWarning after the other attributes of <html>", () => {
		const layout = CREATE_NEXT_APP_LAYOUT.replace('<html lang="en">', "<html>");
		expect(addSuppressHydrationWarning("app/layout.tsx", layout)).toMatchObject({
			status: "edit",
			text: CREATE_NEXT_APP_LAYOUT.replace('<html lang="en">', "<html suppressHydrationWarning>"),
		});
	});

	it.each([
		[
			"a `>` inside an attribute, so the end of the tag cannot be found",
			'<html lang={locale} className={cn("a", b > c)}>',
			"could not read the <html> tag",
		],
		["suppressHydrationWarning={false}", '<html lang="en" suppressHydrationWarning={false}>', "={false}"],
	])("INIT-K4 does not touch a layout with %s, and says why", (_case, tag, why) => {
		const layout = CREATE_NEXT_APP_LAYOUT.replace('<html lang="en">', tag);
		expect(addSuppressHydrationWarning("app/layout.tsx", layout)).toEqual({
			status: "manual",
			reason: expect.stringContaining(why),
		});
	});

	it("INIT-K4 does not touch a layout without <html>, and names the file", () => {
		const layout = "export default function L({ children }: { children: React.ReactNode }) { return children; }\n";
		expect(addSuppressHydrationWarning("app/layout.tsx", layout)).toEqual({
			status: "manual",
			reason: expect.stringMatching(/app\/layout\.tsx has no <html>/),
		});
	});
});

describe("ignoreForMonti", () => {
	it("INIT-K5 adds .monti/ once, on a line of its own, and keeps the lines that are there", () => {
		expect(ignoreForMonti("node_modules\n.env.local")).toEqual({
			status: "edit",
			text: "node_modules\n.env.local\n.monti/\n",
			change: expect.stringContaining(".monti/"),
		});
		expect(ignoreForMonti("node_modules\n.env.local\n.monti/\n")).toEqual({ status: "present" });
	});

	it.each([
		".monti",
		"/.monti/",
		".monti/*",
	])("INIT-K5 keeps a .gitignore whose line %s already covers .monti/", (line) => {
		expect(ignoreForMonti(`${line}\n.env.local\n`)).toEqual({ status: "present" });
	});
});

describe("wrapNextConfig on a file that only mentions withCms", () => {
	const WRAPPED =
		'import { withCms } from "@monti-cms/nextjs/config";\nconst nextConfig = {};\nexport default withCms(nextConfig);\n';

	it("INIT-K4 still wraps the export, adding the import once", () => {
		const result = wrapNextConfig(
			"next.config.ts",
			"// wrap with withCms later\nconst nextConfig = {};\nexport default nextConfig;\n",
		);
		expect(result).toMatchObject({
			status: "edit",
			text: expect.stringContaining("export default withCms(nextConfig);"),
		});
		// The import is there once.
		expect(result).toMatchObject({
			text: expect.toSatisfy((text: string) => text.split("import { withCms }").length === 2),
		});
	});

	it("INIT-K4 leaves a wrapped file alone", () => {
		expect(wrapNextConfig("next.config.ts", WRAPPED)).toEqual({ status: "present" });
	});
});
