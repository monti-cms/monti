import { describe, expect, it } from "vitest";
import { parseMapping } from "../mapping";
import { planFiles } from "../plan";
import { derivePath } from "../source";
import { importSite, mdxRegistry, source } from "./helpers";

const formats = mdxRegistry();
const mapping = parseMapping(
	{
		version: 1,
		locale: { from: ["frontMatter", "filename", "folder"] },
		folders: { "content/posts": { collection: "post", fields: { title: "title", slug: "@slug" } } },
	},
	"m",
);

const english = importSite([{ code: "en", name: "English" }]);
const both = importSite();
const planWith = (site: ReturnType<typeof importSite>, files: ReturnType<typeof source>[]) =>
	planFiles(files, { site, mapping, formats });

describe("a file named for a language the site does not have", () => {
	it("is skipped with a reason and a warning, and never gets an address like helloko", () => {
		const [en, ko] = planWith(english, [
			source("posts/hello.en.mdx", "---\ntitle: Hello\n---\nHi\n"),
			source("posts/hello.ko.mdx", "---\ntitle: 안녕\n---\n안녕\n"),
		]);
		expect(en).toMatchObject({ slug: "hello", locale: "en" });
		expect(en?.skip).toBeUndefined();
		expect(ko?.skip).toMatch(/\.ko.*not one of the site's languages \(en\)/);
		expect(ko?.warnings).toEqual([
			expect.objectContaining({ kind: "unknown_locale", message: expect.stringMatching(/add ko to "locales"/) }),
		]);
		expect(ko?.slug).not.toBe("helloko");
		expect(ko?.errors).toEqual([]);
	});

	it("is imported as the translation once the language is configured", () => {
		const [en, ko] = planWith(both, [
			source("posts/hello.en.mdx", "---\ntitle: Hello\n---\nHi\n"),
			source("posts/hello.ko.mdx", "---\ntitle: 안녕\n---\n안녕\n"),
		]);
		expect(en?.skip).toBeUndefined();
		expect(ko).toMatchObject({ locale: "ko", slug: "hello" });
		expect(ko?.skip).toBeUndefined();
	});

	it("does not take ordinary dotted names for languages", () => {
		const [one, two] = planWith(english, [
			source("posts/release.notes.mdx", "---\ntitle: R\n---\nx\n"),
			source("posts/api.min.mdx", "---\ntitle: A\n---\nx\n"),
		]);
		expect(one?.skip).toBeUndefined();
		expect(two?.skip).toBeUndefined();
		expect(derivePath("posts/release.notes.mdx", ["en"]).unknownLocaleSuffix).toBeUndefined();
	});

	it("is named by the path, so the dry run can list it", () => {
		expect(derivePath("posts/hello.ko.mdx", ["en"]).unknownLocaleSuffix).toBe("ko");
		expect(derivePath("posts/hello.pt-BR.mdx", ["en"]).unknownLocaleSuffix).toBe("pt-br");
		expect(derivePath("posts/hello.ko.mdx", ["en", "ko"]).unknownLocaleSuffix).toBeUndefined();
	});
});
