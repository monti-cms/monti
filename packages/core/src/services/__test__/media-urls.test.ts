import { describe, expect, it, vi } from "vitest";
import type { MediaStore } from "../../adapters/r2/types";
import { mediaUrlResolver } from "../media-urls";

const MEDIA_ID = "223e4567-e89b-42d3-a456-426614174000";
const BASE = "https://cdn.test/assets";

const mediaStore = (): MediaStore => ({ getPublicUrl: (key: string) => `${BASE}/${key}` }) as unknown as MediaStore;

describe("mediaUrlResolver", () => {
	it("finds the registered file a public URL belongs to: the key is what follows the store's base", async () => {
		const find = vi.fn(async () => [{ id: MEDIA_ID, storageKey: "media/photo.png" }]);
		const resolve = mediaUrlResolver(() => ({ findReadyMediaByStorageKeys: find }), mediaStore);

		const found = await resolve([`${BASE}/media/photo.png`, "https://elsewhere.test/media/photo.png", "/relative.png"]);

		expect([...found]).toEqual([[`${BASE}/media/photo.png`, MEDIA_ID]]);
		// Only the URL that is the store's is looked up, as its key.
		expect(find).toHaveBeenCalledWith({ keys: ["media/photo.png"] });
	});

	it("leaves out a URL no ready file holds, and asks the store once for all of them", async () => {
		const find = vi.fn(async () => [{ id: MEDIA_ID, storageKey: "media/a.png" }]);
		const resolve = mediaUrlResolver(() => ({ findReadyMediaByStorageKeys: find }), mediaStore);

		const found = await resolve([`${BASE}/media/a.png`, `${BASE}/media/gone.png`]);

		expect([...found.keys()]).toEqual([`${BASE}/media/a.png`]);
		expect(find).toHaveBeenCalledTimes(1);
	});

	it("does not ask the store for URLs that are not its own", async () => {
		const find = vi.fn(async () => []);
		const resolve = mediaUrlResolver(() => ({ findReadyMediaByStorageKeys: find }), mediaStore);

		expect((await resolve(["https://elsewhere.test/a.png"])).size).toBe(0);
		expect(find).not.toHaveBeenCalled();
	});

	it("finds nothing, and does not fail, without a media store or a database", async () => {
		const noStore = mediaUrlResolver(
			() => ({ findReadyMediaByStorageKeys: async () => [] }),
			() => {
				throw new Error("media_not_configured");
			},
		);
		expect((await noStore([`${BASE}/a.png`])).size).toBe(0);

		const noDatabase = mediaUrlResolver(
			() => ({
				findReadyMediaByStorageKeys: async () => {
					throw new Error("connection refused");
				},
			}),
			mediaStore,
		);
		expect((await noDatabase([`${BASE}/a.png`])).size).toBe(0);
	});
});
