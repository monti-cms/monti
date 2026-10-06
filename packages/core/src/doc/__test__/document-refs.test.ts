import { describe, expect, it } from "vitest";
import type { MediaAssetRecord } from "../../core/store";
import { collectRefs, EMPTY_REFS, imageResolverFromRefs } from "../document-refs";
import { type PublicMediaDeps, resolvePublicMedia } from "../public-media";
import { bodyFromMdx, type StoredDocument } from "../stored-document";

const ID_A = "00000000-0000-4000-8000-00000000000a";
const ID_B = "00000000-0000-4000-8000-00000000000b";
const ID_C = "00000000-0000-4000-8000-00000000000c";
const ID_D = "00000000-0000-4000-8000-00000000000d";

const docOf = (mdx: string): StoredDocument => {
	const { doc } = bodyFromMdx(mdx);
	if (!doc) throw new Error("not a document");
	return doc;
};

describe("collectRefs", () => {
	it("lists the media of images and files wherever they sit, each once, in document order", () => {
		const doc = docOf(
			[
				`<Image mediaId="${ID_A}" alt="a" />`,
				`Text with an inline <Image mediaId="${ID_B}" alt="b" /> image.`,
				`- <Image mediaId="${ID_A}" alt="again" />`,
				`> <File mediaId="${ID_C}" label="Report" />`,
				"![outer](https://example.com/a.png)",
			].join("\n\n"),
		);

		expect(collectRefs(doc).media).toEqual([ID_A, ID_B, ID_C]);
	});

	it("does not list an outer address or a media id that only appears in text", () => {
		const doc = docOf(`![outer](https://example.com/a.png)\n\nThe id ${ID_D} is only text.`);

		expect(collectRefs(doc).media).toEqual([]);
	});

	it("has nothing for a missing document", () => {
		expect(collectRefs(null).media).toEqual([]);
		expect(collectRefs(undefined).media).toEqual([]);
	});
});

describe("resolvePublicMedia", () => {
	const asset = (patch: Partial<MediaAssetRecord> & { id: string }): MediaAssetRecord =>
		({
			status: "ready",
			filename: `${patch.id}.png`,
			mimeType: "image/png",
			byteSize: 10,
			width: 4,
			height: 3,
			storageKey: `media/${patch.id}.png`,
			...patch,
		}) as MediaAssetRecord;
	const rows = new Map<string, MediaAssetRecord>([
		[ID_A, asset({ id: ID_A })],
		[ID_B, asset({ id: ID_B, status: "pending", storageKey: null })],
		[ID_C, asset({ id: ID_C, storageKey: null })],
		[ID_D, asset({ id: ID_D, width: null, height: null, mimeType: "application/pdf", filename: "report.pdf" })],
	]);
	const lookups: string[] = [];
	const deps: PublicMediaDeps = {
		store: () => ({ getMediaAsset: async (id: string) => (lookups.push(id), rows.get(id) ?? null) }) as never,
		mediaStore: () => ({ getPublicUrl: (key: string) => `https://cdn.test/${key}` }) as never,
	};

	it("gives a ready file its URL and size, and any other media the reason it has none", async () => {
		const resolved = await resolvePublicMedia(deps, [ID_A, ID_B, ID_C, ID_D, "00000000-0000-4000-8000-0000000000ff"]);

		expect(resolved.get(ID_A)).toMatchObject({ url: `https://cdn.test/media/${ID_A}.png`, width: 4, height: 3 });
		expect(resolved.get(ID_B)).toEqual({ failure: "not-ready" });
		expect(resolved.get(ID_C)).toEqual({ failure: "unresolved" });
		// An attachment has no size, and keeps the file info for the file card.
		const attachment = resolved.get(ID_D);
		expect(attachment).toMatchObject({ url: `https://cdn.test/media/${ID_D}.png`, file: { filename: "report.pdf" } });
		expect(attachment).not.toHaveProperty("width");
		// A media id with no row is left out, so a resolver reads it as unresolved.
		expect(resolved.has("00000000-0000-4000-8000-0000000000ff")).toBe(false);
	});

	it("asks for nothing when there is nothing to resolve, and resolves nothing without a database or storage", async () => {
		lookups.length = 0;
		expect((await resolvePublicMedia(deps, [])).size).toBe(0);
		expect(lookups).toEqual([]);

		const none = await resolvePublicMedia(
			{
				store: () => {
					throw new Error("no database");
				},
				mediaStore: () => {
					throw new Error("no media storage");
				},
			},
			[ID_A],
		);
		expect(none.size).toBe(0);
	});
});

describe("imageResolverFromRefs", () => {
	const refs = { media: { [ID_A]: { url: "https://cdn.test/a.png", width: 4, height: 3 } } };

	it("looks a registered media id up in the refs, and an id that is not there is unresolved", () => {
		const resolve = imageResolverFromRefs(refs);

		expect(resolve({ mediaId: ID_A })).toEqual({ url: "https://cdn.test/a.png", width: 4, height: 3 });
		expect(resolve({ mediaId: ID_B })).toEqual({ failure: "unresolved" });
		expect(imageResolverFromRefs(EMPTY_REFS)({ mediaId: ID_A })).toEqual({ failure: "unresolved" });
	});

	it("keeps the allow rules for an outer address", () => {
		const resolve = imageResolverFromRefs(refs);

		expect(resolve({ src: "/images/a.png" })).toEqual({ url: "/images/a.png" });
		expect(resolve({ src: "javascript:alert(1)" })).toEqual({ failure: "rejected" });
		expect(resolve({})).toEqual({ failure: "unresolved" });
	});
});
