import { describe, expect, it, vi } from "vitest";
import { createMediaService, STALE_UPLOAD_AFTER_MS } from "../media-service";

const media = (id: string, extra: Record<string, unknown> = {}) => ({
	id,
	storageKey: `media/${id}.png`,
	stagingKey: `staging/${id}.png`,
	original: null,
	...extra,
});

function setup(options: { failFor?: readonly string[]; stale?: readonly ReturnType<typeof media>[] } = {}) {
	const deleted: string[] = [];
	const finalized: string[] = [];
	const store = {
		finalizeMediaDelete: vi.fn(async (id: string) => {
			finalized.push(id);
		}),
		listStaleUploads: vi.fn(async () => options.stale ?? []),
	};
	const mediaStore = {
		deleteFile: vi.fn(async ({ key }: { key: string }) => {
			if (options.failFor?.some((part) => key.includes(part))) throw new Error("storage down");
			deleted.push(key);
		}),
	};
	const now = new Date("2026-01-10T00:00:00Z");
	return {
		service: createMediaService({ store: () => store as never, mediaStore: () => mediaStore as never, now: () => now }),
		store,
		deleted,
		finalized,
		now,
	};
}

describe("media service", () => {
	it("deletes every file of an asset, then its row", async () => {
		const { service, deleted, finalized } = setup();
		await service.remove(media("a", { original: { storageKey: "o/key", stagingKey: null } }));
		expect(deleted).toEqual(["media/a.png", "staging/a.png", "o/key"]);
		expect(finalized).toEqual(["a"]);
	});

	it("keeps the row when a file cannot be deleted, so the delete can be repeated", async () => {
		const { service, finalized } = setup({ failFor: ["staging/"] });
		await expect(service.remove(media("a"))).rejects.toThrow("storage down");
		expect(finalized).toEqual([]);
	});

	it("cleans up stale uploads with the same rules, reports the ones it could not, and asks for uploads older than a day", async () => {
		const { service, store, deleted, finalized, now } = setup({
			stale: [media("ok"), media("bad", { stagingKey: "staging/bad.png" })],
			failFor: ["staging/bad"],
		});
		expect(await service.cleanup()).toEqual({ removed: 1, failed: ["bad"] });
		expect(store.listStaleUploads).toHaveBeenCalledWith({ before: new Date(now.getTime() - STALE_UPLOAD_AFTER_MS) });
		// Only what was staged is removed: an upload that never completed has no final file.
		expect(deleted).toEqual(["staging/ok.png"]);
		expect(finalized).toEqual(["ok"]);
	});
});
