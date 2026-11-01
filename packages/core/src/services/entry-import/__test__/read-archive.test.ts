import { describe, expect, it } from "vitest";
import { paragraph } from "../../../../test/entry-import-fixture";
import { doc, paragraphsFormat } from "../../../../test/paragraphs-format";
import { overlappingZip } from "../../../../test/zip-bomb";
import { CmsError } from "../../../core/store/errors";
import { createFormatRegistry } from "../../../format/registry";
import { type CmsFormat, defineFormat } from "../../../format/types";
import { createZipArchive } from "../../zip";
import { MAX_IMPORT_INFLATED_BYTES, readImportArchive } from "../read-archive";

const encode = (text: string) => new TextEncoder().encode(text);

const markdownFormat = defineFormat({ ...paragraphsFormat, name: "markdown", extension: "md" });
const mdxFormat = defineFormat({ ...paragraphsFormat, name: "mdx", extension: "mdx" });
/** A format that writes `.md` but cannot read it. */
const mdExportOnly = defineFormat({
	name: "md-out",
	label: "md out",
	mimeType: "text/markdown",
	extension: "md",
	export: () => "",
});

const read = (files: { path: string; text: string }[], formats: readonly CmsFormat[] = [markdownFormat, mdxFormat]) =>
	readImportArchive(createZipArchive(files.map(({ path, text }) => ({ path, data: encode(text) }))), {
		site: { DEFAULT_LOCALE: "de" },
		formats: createFormatRegistry(formats),
	});

/** The notice key of the refusal `run` throws. */
const refusal = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		if (error instanceof CmsError) {
			const notice = error.notice as { key?: string; vars?: Record<string, string> } | undefined;
			return { key: notice?.key, vars: notice?.vars };
		}
		throw error;
	}
	throw new Error("expected the archive to be refused");
};

const byKey = <T extends { key: string }>(entries: readonly T[]) =>
	Object.fromEntries(entries.map((entry) => [entry.key, entry]));

describe("readImportArchive", () => {
	describe("an export", () => {
		const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
		const exportOf = (
			listed: { id: string; status: string; hasPublished: boolean; files?: boolean }[],
		): { path: string; text: string }[] => [
			{
				path: "manifest.json",
				text: JSON.stringify({
					entries: listed.map(({ id, status, hasPublished }) => ({
						id,
						collection: "note",
						locale: "de",
						translationGroupId: id,
						status,
						hasPublished,
					})),
				}),
			},
			...listed
				.filter((item) => item.files !== false)
				.map((item) => ({
					path: `entries/note/${item.id}/${item.hasPublished ? "published" : "working"}.json`,
					text: JSON.stringify({
						slug: `entry-${item.id.slice(-1)}`,
						metadata: { title: "A title" },
						doc: doc(paragraph("Body")),
					}),
				})),
		];

		it("DATA-I3 counts an entry as published only when it was published in the archive, not when it was archived", () => {
			const source = read(
				exportOf([
					{ id: id(1), status: "published", hasPublished: true },
					// An archived entry keeps its published copy, but it is not on the site.
					{ id: id(2), status: "archived", hasPublished: true },
					{ id: id(3), status: "draft", hasPublished: false },
				]),
			);
			const entries = byKey(source.entries);
			expect([id(1), id(2), id(3)].map((key) => entries[key]?.published)).toEqual([true, false, false]);
		});

		it("DATA-I9 an entry whose files are not in the archive is read as unreadable, and the others are read", () => {
			const source = read(
				exportOf([
					{ id: id(1), status: "draft", hasPublished: false, files: false },
					{ id: id(2), status: "draft", hasPublished: false },
				]),
			);
			const entries = byKey(source.entries);
			expect(entries[id(1)]).toMatchObject({ slug: null, body: null, problem: { code: "unreadable" } });
			expect(entries[id(2)]).toMatchObject({ slug: "entry-2", body: { kind: "doc" } });
			expect(entries[id(2)]?.problem).toBeUndefined();
		});
	});

	describe("a folder of text files", () => {
		it("DATA-I5 reads .md with the MDX format when the site has no Markdown one, names each entry after its file, and never marks one published", () => {
			const source = read(
				[
					{ path: "note/hello.md", text: "---\ntitle: Hello\n---\n\nHello text\n" },
					{ path: "note/world.mdx", text: "---\ntitle: World\n---\n\nWorld text\n" },
					{ path: "note/year.md", text: "---\ntitle: 1984\nslug: 2024\n---\n\nYear text\n" },
					{ path: "top.md", text: "---\ntitle: Top\n---\n\nTop text\n" },
				],
				[mdExportOnly, mdxFormat],
			);
			expect(source.kind).toBe("markdown");
			const entries = byKey(source.entries);
			expect(entries["note/hello.md"]).toMatchObject({
				collection: "note",
				locale: "de",
				isSource: true,
				title: "Hello",
				slug: "hello",
				published: false,
				body: { kind: "text", format: "mdx", text: "Hello text\n" },
			});
			expect(entries["note/world.mdx"]).toMatchObject({ slug: "world", body: { kind: "text", format: "mdx" } });
			// A YAML number is a title and a slug too.
			expect(entries["note/year.md"]).toMatchObject({ title: "1984", slug: "2024" });
			// A file at the top of the archive is in no collection folder.
			expect(entries["top.md"]).toMatchObject({ collection: "", slug: "top" });
		});

		it("DATA-I5 refuses a folder with files no installed format reads, instead of leaving them out", () => {
			const files = [
				{ path: "note/a.md", text: "---\ntitle: A\n---\n\nA\n" },
				{ path: "note/b.mdx", text: "---\ntitle: B\n---\n\nB\n" },
			];
			expect(refusal(() => read(files, [markdownFormat]))).toEqual({
				key: "import.format.missing",
				vars: { extension: "mdx" },
			});
		});

		it("DATA-I9 says which file has front matter it cannot read, and on which line", () => {
			const source = read([
				{ path: "note/broken.md", text: "---\ntitle: Fine\ntitle: Twice\n---\n\nText\n" },
				{ path: "note/fine.md", text: "---\ntitle: Fine\n---\n\nText\n" },
			]);
			const entries = byKey(source.entries);
			expect(entries["note/broken.md"]).toMatchObject({
				collection: "note",
				slug: "broken",
				body: null,
				problem: { code: "front_matter_invalid", params: { line: 3 } },
			});
			expect(entries["note/broken.md"]?.problem?.params?.message).toContain("YAML");
			expect(entries["note/fine.md"]?.problem).toBeUndefined();
		});
	});

	it("DATA-I5 refuses a zip that is neither an export nor a folder of text files", () => {
		expect(refusal(() => read([{ path: "photos/cat.jpg", text: "not an entry" }])).key).toBe("import.archive.unknown");
	});

	it("DATA-I9 stops reading a zip whose files inflate past the limit", () => {
		const zip = overlappingZip(MAX_IMPORT_INFLATED_BYTES);
		const options = { site: { DEFAULT_LOCALE: "de" }, formats: createFormatRegistry([mdxFormat]) };
		expect(refusal(() => readImportArchive(zip, options)).key).toBe("import.archive.unreadable");
	});
});
