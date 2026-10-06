import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { collectRefs, type ReadRefs } from "../../mdx/document-refs";
import { bodyFromMdx, type StoredDocument } from "../../mdx/stored-document";
import {
	CmsContent,
	type DocumentComponents,
	type FileProps,
	type ImageProps,
	type LooseDocumentComponents,
	renderDocument,
	tableOfContents,
} from "../index";

const MEDIA = "00000000-0000-4000-8000-000000000001";
const MISSING = "00000000-0000-4000-8000-000000000002";
const ATTACHMENT = "00000000-0000-4000-8000-000000000003";

const fromMdx = (source: string): StoredDocument => {
	const body = bodyFromMdx(source);
	if (!body.doc) throw new Error("not a document");
	return body.doc;
};

const loose = (components: LooseDocumentComponents) => components as unknown as DocumentComponents;

const refs: ReadRefs = {
	media: {
		[MEDIA]: { url: "https://cdn.test/photo.png", width: 640, height: 480 },
		[ATTACHMENT]: {
			url: "https://cdn.test/deck.pdf",
			file: { filename: "deck.pdf", byteSize: 100, mimeType: "application/pdf" },
		},
	},
	links: {},
};

const render = async (props: Parameters<typeof CmsContent>[0]) =>
	renderToStaticMarkup((await CmsContent(props)) as ReactNode);

/** `<CmsContent entry={entry} />`: an entry of the read API is drawn with the images and files of its own refs. */
describe("CmsContent with an entry", () => {
	const doc = fromMdx(
		[
			"## Intro",
			`<Image mediaId="${MEDIA}" alt="a photo" />`,
			`<Image mediaId="${MISSING}" alt="gone" />`,
			`<File mediaId="${ATTACHMENT}" label="Deck" />`,
		].join("\n\n"),
	);

	it("draws images and files from the entry's refs, with no image resolver", async () => {
		const seen: ImageProps[] = [];
		const files: FileProps[] = [];
		await render({
			entry: { doc, refs },
			components: loose({
				image: (props: ImageProps) => {
					seen.push(props);
					return null;
				},
				file: (props: FileProps) => {
					files.push(props);
					return null;
				},
			}),
		});

		expect(seen[0]).toMatchObject({ src: "https://cdn.test/photo.png", intrinsic: { width: 640, height: 480 } });
		// A media id that the refs do not hold is unresolved, not an error.
		expect(seen[1]).toMatchObject({ src: undefined, failure: "unresolved" });
		expect(files[0]).toMatchObject({ url: "https://cdn.test/deck.pdf", filename: "deck.pdf" });
	});

	it("resolves every media id of the document from the refs a read returns for it", async () => {
		// What a read returns: refs for exactly the ids `collectRefs` finds.
		const wanted = collectRefs(doc).media;
		expect(wanted).toEqual([MEDIA, MISSING, ATTACHMENT]);
		const markup = await render({ entry: { doc, refs } });

		expect(markup).toContain("https://cdn.test/photo.png");
		expect(markup).toContain("deck.pdf");
	});

	it("takes the language of the page from the entry, and the options win over the entry", async () => {
		const locales: (string | undefined)[] = [];
		const components = loose({
			paragraph: ({ ctx, children }: { ctx: { locale?: string }; children: ReactNode }) => {
				locales.push(ctx.locale);
				return createElement("p", null, children);
			},
		});
		const paragraphs = fromMdx("본문");

		await render({ entry: { doc: paragraphs, locale: "ko" }, components });
		await render({ entry: { doc: paragraphs, locale: "ko" }, locale: "en", components });
		await render({ doc: paragraphs, components });

		expect(locales).toEqual(["ko", "en", undefined]);
	});

	it("lets an image resolver of the site win over the refs", async () => {
		const seen: ImageProps[] = [];
		await render({
			entry: { doc, refs },
			imageResolver: () => ({ url: "https://site.test/own.png" }),
			components: loose({
				image: (props: ImageProps) => {
					seen.push(props);
					return null;
				},
			}),
		});

		expect(seen.map((image) => image.src)).toEqual(Array(2).fill("https://site.test/own.png"));
	});

	it("renders an entry without a document as nothing", async () => {
		expect(await CmsContent({ entry: { doc: null } })).toBeNull();
		expect(await CmsContent({ doc: null })).toBeNull();
	});

	it("renders the same as renderDocument for the same document and refs", async () => {
		const direct = renderToStaticMarkup((await renderDocument(doc, { refs })).content as ReactNode);

		expect(await render({ entry: { doc, refs } })).toBe(direct);
		expect(await render({ doc, refs })).toBe(direct);
	});
});

describe("tableOfContents with an entry's document", () => {
	it("lists the headings of the document, and has none for an entry without one", () => {
		const toc = tableOfContents(fromMdx("## One\n\ntext\n\n### Two"));

		expect(toc.map((item) => [item.value, item.level])).toEqual([
			["One", 2],
			["Two", 3],
		]);
		expect(tableOfContents(null)).toEqual([]);
	});
});
