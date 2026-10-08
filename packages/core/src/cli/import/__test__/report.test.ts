import { describe, expect, it } from "vitest";
import { describeTranslations, type FileResult, formatReport, type ImportReport, summarize } from "../report";

const notice = (message: string, kind: "unknown_field" | "link" = "unknown_field") => ({ kind, message });

const file = (path: string, notices: FileResult["notices"] = []): FileResult => ({
	path,
	status: "imported",
	reason: "new entry",
	collection: "post",
	notices,
});

const reportOf = (overrides: Partial<ImportReport>): ImportReport => {
	const base = {
		dryRun: false,
		path: "content",
		publish: false,
		mappingFile: "monti.import.json",
		mappingSaved: false,
		mapping: { version: 1 as const, folders: {} },
		files: [],
		counts: { imported: 0, updated: 0, skipped: 0, failed: 0 },
		collections: {},
		translations: [],
		createdTargets: {},
		media: { uploaded: 0, reused: 0, wouldUpload: 0, copied: 0, wouldCopy: 0, configured: false },
		links: { resolved: 0, unresolved: 0 },
		notes: [],
		...overrides,
	};
	return { ...base, summary: summarize(base) };
};

const SKIPPED_TAGS = '"tags" has no field in post, so it is skipped';

describe("the import report", () => {
	const files = ["a.md", "b.md", "c.md", "d.md", "e.md"].map((name) => file(`content/${name}`, [notice(SKIPPED_TAGS)]));

	it("tells a warning that repeats in several files once, with the files it is in", () => {
		const text = formatReport(reportOf({ files, counts: { imported: 5, updated: 0, skipped: 0, failed: 0 } }));
		expect(text.split(SKIPPED_TAGS)).toHaveLength(2);
		expect(text).toContain("Repeated in several files:");
		expect(text).toContain(
			`unknown field: ${SKIPPED_TAGS} (5 files: content/a.md, content/b.md, content/c.md, and 2 more)`,
		);
	});

	it("does the same in a dry run, where a file with only a repeated warning is not a problem file", () => {
		const text = formatReport(
			reportOf({
				dryRun: true,
				files: [...files, file("content/odd.md", [notice('"weird" has no field in post, so it is skipped')])],
				collections: { post: { files: 6, imported: 6, updated: 0, skipped: 0, failed: 0, translations: 0 } },
			}),
		);
		expect(text.split(SKIPPED_TAGS)).toHaveLength(2);
		expect(text).toMatch(/Problem files:\n {2}content\/odd\.md\n {4}unknown field: "weird"/);
		expect(text).not.toMatch(/ {2}content\/a\.md\n/);
	});

	it("keeps a warning under its file when it is in only one or two files", () => {
		const text = formatReport(reportOf({ files: files.slice(0, 2) }));
		expect(text).not.toContain("Repeated in several files");
		expect(text).toContain(`content/a.md: new entry\n    unknown field: ${SKIPPED_TAGS}`);
		expect(text.split(SKIPPED_TAGS)).toHaveLength(3);
	});

	it("explains what a translation is instead of 'in other languages'", () => {
		expect(
			describeTranslations([{ path: "content/notes.en.md", collection: "post", locale: "en", slug: "notes" }]),
		).toBe("1 translation (en of notes) joined to its source");
		const many = describeTranslations(
			["a", "b", "c", "d", "e", "f"].map((slug) => ({ path: `${slug}.ko.md`, collection: "post", locale: "ko", slug })),
		);
		expect(many).toBe(
			"6 translations (ko of a, ko of b, ko of c, ko of d, ko of e, and 1 more) joined to their sources",
		);
		expect(describeTranslations([])).toBeUndefined();

		const text = formatReport(
			reportOf({
				dryRun: true,
				collections: { post: { files: 2, imported: 2, updated: 0, skipped: 0, failed: 0, translations: 1 } },
				translations: [{ path: "content/notes.en.md", collection: "post", locale: "en", slug: "notes" }],
			}),
		);
		expect(text).not.toContain("other languages");
		expect(text).toContain("1 translation)");
		expect(text).toContain("Translations: 1 translation (en of notes) joined to its source.");
	});
});
