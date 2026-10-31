import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import { STORED_DOCUMENT_VERSION } from "../../doc/stored-document";
import { createBulkService } from "../bulk-service";
import { createContentService } from "../content-service";
import type { Reference } from "../index";

const mediaId = "987e4567-e89b-12d3-a456-426614174000";

/** A store holding one draft whose body is a single image of the media `mediaId`. Publishing just reports the next version. */
const store = () => ({
	async getWorkingReferences() {
		return [] as Reference[];
	},
	async getWorking() {
		return {
			collection: contentCollection,
			slug: "hello",
			metadata: { title: "Hello" },
			doc: {
				type: "doc",
				version: STORED_DOCUMENT_VERSION,
				content: [{ type: "image", attrs: { mediaId, alt: "a" } }],
			},
			version: 3,
			folderId: null,
			locale: null,
		};
	},
	async publishEntry() {
		return { version: 4 };
	},
});

const pending = { getMediaAsset: async () => ({ status: "pending", storageKey: null }) };
const imageNotReady = expect.objectContaining({ code: "image_media_not_ready", message: "pending" });

describe("image warnings of a publish", () => {
	it("WRITE-P1 a single publish reports them", async () => {
		const service = createContentService(store() as never, { site: testSite, imageChecks: pending });
		const { warnings } = await service.publish({ id: "e1", expectedVersion: 3 });
		expect(warnings).toContainEqual(imageNotReady);
	});

	it("WRITE-P1 a bulk publish reports the same warnings per item", async () => {
		const bulk = createBulkService(store() as never, { site: testSite, imageChecks: pending });
		const { results } = await bulk.run({ op: "publish", items: [{ id: "e1", expectedVersion: 3 }] });
		expect(results).toEqual([
			expect.objectContaining({ id: "e1", ok: true, warnings: expect.arrayContaining([imageNotReady]) }),
		]);
	});

	it("WRITE-P1 a service without image checks reports none", async () => {
		const service = createContentService(store() as never, { site: testSite });
		const { warnings } = await service.publish({ id: "e1", expectedVersion: 3 });
		expect(warnings).not.toContainEqual(imageNotReady);
	});

	it("WRITE-P1 keeps the snapshot's own warnings when the image lookup fails", async () => {
		const failing = {
			getMediaAsset: async () => {
				throw new Error("db down");
			},
		};
		const withOrphan = store();
		const getWorking = withOrphan.getWorking;
		withOrphan.getWorking = async () => ({
			...(await getWorking()),
			metadata: { title: "Hello", leftover: "from a removed field" },
		});
		const service = createContentService(withOrphan as never, { site: testSite, imageChecks: failing });
		const { warnings } = await service.publish({ id: "e1", expectedVersion: 3 });
		expect(warnings).toContainEqual(expect.objectContaining({ code: "orphaned_metadata_key", path: "leftover" }));
	});
});
