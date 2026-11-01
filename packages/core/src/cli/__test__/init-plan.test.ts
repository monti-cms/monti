import { describe, expect, it } from "vitest";
import type { InitAnswers } from "../init-answers";
import type { DetectedApp } from "../init-detect";
import { localeNote, timeZoneNote } from "../init-plan";

describe("the time zone line of the summary", () => {
	it("INIT-Q4 names the zone, where it came from and what to change", () => {
		const fromComputer = timeZoneNote({ timeZone: "Asia/Seoul", timeZoneSource: "computer" }, "src/monti.schema.ts");
		expect(fromComputer).toContain("Asia/Seoul");
		expect(fromComputer).toContain("this computer");
		expect(fromComputer).toContain("`timeZone` in src/monti.schema.ts");

		const fromFlag = timeZoneNote({ timeZone: "Asia/Tokyo", timeZoneSource: "flag" }, "monti.schema.ts");
		expect(fromFlag).toContain("Asia/Tokyo");
		expect(fromFlag).toContain("--time-zone");
		expect(fromFlag).toContain("`timeZone` in monti.schema.ts");

		const fallback = timeZoneNote({ timeZone: "UTC", timeZoneSource: "fallback" }, "monti.schema.ts");
		expect(fallback).toContain("UTC");
		expect(fallback).toContain("could not be read");
		expect(fallback).toContain("`timeZone` in monti.schema.ts");
	});
});

describe("the language line of the summary", () => {
	const app: DetectedApp = {
		cwd: "/app",
		appDir: "app",
		src: false,
		hasAppRouter: true,
		pagesRouterOnly: false,
		packageManager: "pnpm",
		typescript: true,
		contentFolders: [
			{
				dir: "content/posts",
				files: 3,
				keys: [],
				locales: [
					{ code: "ko", files: 2, unpaired: 1 },
					{ code: "en", files: 1, unpaired: 0 },
				],
				localesFrom: "filename",
			},
		],
		devPort: 3000,
		dependencies: new Set(),
	};
	const answers = (locales: string[]): InitAnswers => ({
		siteUrl: "http://localhost:3000",
		locales,
		timeZone: "UTC",
		timeZoneSource: "computer",
		storage: "none",
		ai: false,
		blocks: [],
		adminPath: "/studio",
		login: "password",
		directiveSyntax: true,
	});

	it("INIT-Q3 names the languages found, where, and the default, or what the files would have given when the site languages differ", () => {
		const taken = localeNote(app, answers(["ko", "en"]), false);
		expect(taken).toContain("The site languages are ko, en, found in the file names of content/posts/");
		expect(taken).toContain("ko is the default");
		const other = localeNote(app, answers(["en"]), true);
		expect(other).toContain("ko, en found in the file names of content/posts/");
		expect(other).toContain("the site languages are en");
		expect(localeNote(app, answers(["ko", "en"]), true)).toContain("found in the file names of content/posts/, but");
		expect(localeNote({ ...app, contentFolders: [] }, answers(["en"]), false)).toBeUndefined();
	});
});
