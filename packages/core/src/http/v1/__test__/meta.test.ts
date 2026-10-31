import { describe, expect, it } from "vitest";
import { testConfig } from "../../../../test/site";
import { fakeCms } from "../../../cms";
import { MAX_DOC_BYTES, MAX_TEXT_BYTES } from "../../../core/limits";
import { routeCaller } from "../../../testing";
import { GET as getMetaHandler } from "../meta/route";

const getMeta = routeCaller(getMetaHandler);

const readFeatures = async (cms = fakeCms()) => {
	const res = await getMeta(new Request("http://localhost/api/monti/v1/meta"), { cms });
	expect(res.status).toBe(200);
	return (await res.json()).features as Record<string, boolean | Record<string, boolean>>;
};

describe("GET /v1/meta features.media", () => {
	it("is false when the server config has no media storage", async () => {
		expect((await readFeatures(fakeCms())).media).toBe(false);
	});

	it("MEDIA-U6 is true when the server config has media storage", async () => {
		expect((await readFeatures(fakeCms({ mediaStore: {} }))).media).toBe(true);
	});

	it("PLUG-S5 puts plugin features under the plugin name, next to the core ones", async () => {
		const features = await readFeatures(
			fakeCms({ plugins: [{ name: "ai", features: async () => ({ ready: true }) }] }),
		);
		expect(features.ai).toEqual({ ready: true });
		expect(features.media).toBe(false);
		expect(features.ready).toBeUndefined();
	});
});


describe("GET /v1/meta folders and templates", () => {
	const readMeta = async (cms: unknown) =>
		(await getMeta(new Request("http://localhost/api/monti/v1/meta"), { cms: cms as never })).json();

	it("reports for every collection whether it uses folders, as a boolean", async () => {
		const meta = await readMeta(fakeCms({ config: testConfig }));
		for (const name of meta.collections as string[]) {
			expect(typeof meta.definitions[name].folders).toBe("boolean");
		}
	});

	it("LIST-F6 gives a collection its kind's default unless its schema says otherwise", async () => {
		const meta = await readMeta(fakeCms({ config: testConfig }));
		for (const name of meta.collections as string[]) {
			const explicit = meta.schemas[name].folders;
			const kind = meta.definitions[name].kind;
			expect(meta.definitions[name].folders).toBe(explicit ?? kind === "document");
		}
	});

});
