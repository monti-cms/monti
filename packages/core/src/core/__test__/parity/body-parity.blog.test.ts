import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../../test/any-site";
import { documentText, EXCERPT_TEXT, SEARCH_TEXT } from "../../body-text";
import { prepareSnapshot, validateForPublish } from "../../snapshot";
import { parityCorpus } from "./corpus";
import golden from "./golden.json";

/**
 * Parity with the checks that ran over the MDX text (its mdast) before bodies were checked as documents. `golden.json` holds what that path
 * produced for every body of the corpus (`corpus.ts`): the content hash, the issue and warning codes, the references, the links and image
 * sources, the search text and the excerpt text. A body that read as a document must give the same hash (it is stored data: a different
 * hash would make every saved entry look changed) and the same codes. A body that could not become a document is an `unparsed` body now: it
 * keeps the reasons it was rejected for and adds `unparsed_body`.
 */

type Golden = {
	parsed: boolean;
	hash: string;
	issues: string[];
	warnings: string[];
	publishIssues: string[];
	publishWarnings: string[];
	references: string[];
	internalLinks: string[];
	imageSources: string[];
	searchText: string;
	excerptText: string;
};

/**
 * The one place the codes differ. The old check only looked at tables written as `<Table>`; a stored table does not remember how it was written, so
 * a pipe table with a short row is now checked like any other and warns `invalid_table_span` (a notice, never a blocker).
 */
const ACCEPTED_NEW_WARNINGS: Readonly<Record<string, readonly string[]>> = {
	"table pipe short row": ["invalid_table_span"],
};
const withAccepted = (name: string, codes: readonly string[]) =>
	[...new Set([...codes, ...(ACCEPTED_NEW_WARNINGS[name] ?? [])])].sort();

const unique = (items: readonly { code: string }[] | undefined) =>
	[...new Set((items ?? []).map((i) => i.code))].sort();
const goldenOf = (name: string) => (golden as Record<string, Golden>)[name] as Golden;

const prepare = async (mdx: string) => {
	const snap = await prepareSnapshot({
		collection: contentCollection,
		slug: "parity",
		metadata: { title: "Parity" },
		mdx,
	});
	const publish = validateForPublish(snap, {
		targets: [],
		media: [],
		internalLinks: (snap.internalLinks ?? []).map((l) => ({
			collection: l.collection,
			slug: l.slug,
			addressType: "missing" as const,
			isPublished: false,
		})),
	});
	return { snap, publish };
};

describe("stored-document checks keep the results of the checks over MDX text", () => {
	const corpus = parityCorpus();

	it("has a recorded result for every body of the corpus", () => {
		expect(corpus.filter(({ name }) => !(name in golden))).toEqual([]);
	});

	for (const { name, mdx } of corpus) {
		const before = goldenOf(name);
		if (!before) continue;

		if (before.parsed) {
			it(`${name}: same hash, codes, references and text`, async () => {
				const { snap, publish } = await prepare(mdx);
				expect(snap.contentHash).toBe(before.hash);
				expect(unique(snap.issues)).toEqual(before.issues);
				expect(unique(snap.warnings)).toEqual(withAccepted(name, before.warnings));
				expect(unique(publish.issues)).toEqual(before.publishIssues);
				expect(unique(publish.warnings)).toEqual(withAccepted(name, before.publishWarnings));
				expect(snap.references.map((r) => `${r.kind}:${r.targetId}`).sort()).toEqual(before.references);
				expect([...new Set((snap.internalLinks ?? []).map((l) => l.url))].sort()).toEqual(
					[...new Set(before.internalLinks)].sort(),
				);
				expect(snap.imageSources.map((s) => s.mediaId ?? s.src)).toEqual(before.imageSources);
				expect(documentText(snap.doc, SEARCH_TEXT)).toBe(before.searchText);
				expect(documentText(snap.doc, EXCERPT_TEXT)).toBe(before.excerptText);
			});
			continue;
		}

		it(`${name}: an unparsed body that keeps its reasons and blocks publishing`, async () => {
			const { snap, publish } = await prepare(mdx);
			expect(snap.doc.content).toEqual([
				expect.objectContaining({ type: "unparsed", attrs: { format: "mdx", source: mdx } }),
			]);
			// Why the text was rejected (a parse error, front matter) is still reported.
			const reasons = before.issues.filter((code) => code === "mdx_error" || code === "frontmatter_present");
			expect(unique(snap.issues)).toEqual([...new Set([...reasons, "unparsed_body"])].sort());
			expect(unique(publish.issues)).toContain("unparsed_body");
			// Text that does not parse has always been hashed as it is.
			if (reasons.length > 0) expect(snap.contentHash).toBe(before.hash);
		});
	}
});
