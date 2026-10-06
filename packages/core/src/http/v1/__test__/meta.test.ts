import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { fakeCms } from "../../../cms";
import { MAX_DOC_BYTES, MAX_MDX_BYTES } from "../../../core/snapshot";
import { GET as getMeta } from "../meta/route";

const readFeatures = async (cms = fakeCms()) => {
	const res = await getMeta(new NextRequest("http://localhost/api/cms/v1/meta"), { cms });
	expect(res.status).toBe(200);
	return (await res.json()).features as Record<string, boolean | Record<string, boolean>>;
};

describe("GET /v1/meta features.media", () => {
	it("is false when the server config has no media storage", async () => {
		expect((await readFeatures(fakeCms())).media).toBe(false);
	});

	it("is true when the server config has media storage", async () => {
		expect((await readFeatures(fakeCms({ mediaStore: {} }))).media).toBe(true);
	});

	it("puts plugin features under the plugin name, next to the core ones", async () => {
		const features = await readFeatures(
			fakeCms({ plugins: [{ name: "ai", features: async () => ({ ready: true }) }] }),
		);
		expect(features.ai).toEqual({ ready: true });
		expect(features.folders).toBe(true);
		expect(features.ready).toBeUndefined();
	});
});

describe("GET /v1/meta limits", () => {
	it("reports the document limit next to the MDX limit", async () => {
		const res = await getMeta(new NextRequest("http://localhost/api/cms/v1/meta"), { cms: fakeCms() });
		const { limits } = await res.json();
		expect(limits.mdxBytes).toBe(MAX_MDX_BYTES);
		expect(limits.docBytes).toBe(MAX_DOC_BYTES);
	});
});
