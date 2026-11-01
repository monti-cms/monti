import { describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../../test/site";
import { fakeCms } from "../../../cms";
import type { MediaAssetRecord } from "../../../core/store/types";
import { buildExportArchive } from "../../export-service";
import { planRestore } from "../plan";

const TIME = new Date("2026-09-22T00:00:00.000Z");
const ids = {
	present: "11111111-1111-4111-8111-111111111111",
	missing: "22222222-2222-4222-8222-222222222222",
	alsoMissing: "33333333-3333-4333-8333-333333333333",
	trashed: "44444444-4444-4444-8444-444444444444",
};

const mediaFile = (id: string, status: MediaAssetRecord["status"] = "ready"): MediaAssetRecord => ({
	id,
	folderId: null,
	status,
	filename: `${id.slice(0, 4)}.png`,
	mimeType: "image/png",
	byteSize: 10,
	width: 1,
	height: 1,
	stagingKey: null,
	storageKey: `media/${id}.png`,
	original: null,
	defaultAlt: "",
	defaultCaption: "",
	createdAt: TIME,
	updatedAt: TIME,
	readyAt: TIME,
	deletedAt: status === "trashed" ? TIME : null,
});

/** A full backup of a site that holds media records and nothing else. */
const backupOf = (media: MediaAssetRecord[]) =>
	buildExportArchive(
		{ entries: [], references: [], folders: [], addresses: [], media, templates: [], preferences: [] },
		{ site: testSite, scope: "admin", exportedAt: TIME, selection: null },
	).zip;

/** The site a backup is restored into: what it holds, and the media storage it has (none when not given). */
const siteWith = (
	content: Partial<Record<"entries" | "folders" | "media", number>> = {},
	headFile?: (input: { key: string }) => Promise<unknown>,
) =>
	fakeCms({
		config: testConfig,
		store: {
			countSiteContent: async () => ({ entries: 0, folders: 0, media: 0, ...content }),
			listTemplates: async () => [],
		} as never,
		...(headFile ? { mediaStore: { headFile } as never } : {}),
	});

/** Storage that holds the files with these keys. */
const storageWith =
	(...keys: string[]) =>
	async ({ key }: { key: string }) =>
		keys.includes(key) ? { key, contentType: "image/png", contentLength: 10 } : null;

describe("planRestore", () => {
	it.each([
		["an entry in a folder", { entries: 1, folders: 1 }],
		["an image in a folder", { folders: 1, media: 1 }],
	])("DATA-R2 does not take a site that holds %s", async (_, content) => {
		const backup = backupOf([]);
		expect(await planRestore(siteWith(), backup)).toMatchObject({ empty: true, ready: true });
		expect(await planRestore(siteWith(content), backup)).toMatchObject({ empty: false, ready: false });
	});

	it("DATA-R7 warns of each ready media file that is missing from storage, and of no other", async () => {
		const files = [
			mediaFile(ids.present),
			mediaFile(ids.missing),
			mediaFile(ids.alsoMissing),
			mediaFile(ids.trashed, "trashed"),
		];
		const preview = await planRestore(siteWith({}, storageWith(`media/${ids.present}.png`)), backupOf(files));
		expect(preview.ready).toBe(true);
		expect(preview.warnings).toHaveLength(2);
		for (const id of [ids.missing, ids.alsoMissing]) {
			expect(preview.warnings).toContainEqual(
				expect.objectContaining({ code: "media_file_missing", id, label: `${id.slice(0, 4)}.png` }),
			);
		}
	});

	it("DATA-R6 says once that the files were not checked when storage cannot be reached", async () => {
		const files = [mediaFile(ids.present), mediaFile(ids.missing)];
		const unreachable = async ({ key }: { key: string }) => {
			if (key === `media/${ids.missing}.png`) throw new Error("storage is down");
			return null;
		};
		const preview = await planRestore(siteWith({}, unreachable), backupOf(files));
		expect(preview.warnings).toEqual([{ code: "files_not_checked" }]);
		expect(preview.ready).toBe(true);
	});

	it("DATA-R6 warns of nothing for a backup with no media file, on a site without storage", async () => {
		const preview = await planRestore(siteWith(), backupOf([mediaFile(ids.trashed, "trashed")]));
		expect(preview.warnings).toEqual([]);
	});
});
