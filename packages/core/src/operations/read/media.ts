import { z } from "zod";
import { mediaListQuerySchema } from "../../core/api";
import { CmsError } from "../../core/store/errors";
import { defineOperation } from "../define";

export const listMedia = defineOperation({
	name: "media.list",
	kind: "read",
	describe:
		'The media library, newest upload first unless `sort` says otherwise (`uploadedAsc`, `name`, `size` for the biggest first). Filter by filename (`search`), image or file (`kind`), folder (`folderId`, with `includeDescendants` for its subfolders), upload date, and `used`: "unused" finds files nothing refers to. ' +
		'`alt` "none" finds images without alt text and "has" images with it (alt text exists for images only). ' +
		"Each item has its filename, type, size, public URL and where it is used. " +
		"The answer also has `kinds` ({ image, file }) and `alts` ({ none, has }): how many files each `kind` and `alt` choice would give, counted with every other filter but not with `kind` and `alt` themselves.",
	input: () => mediaListQuerySchema,
	run: async (query, { cms }) => {
		// Interrupted uploads older than a day are cleaned up when the library is read (once a day per process); a failure does not stop the list.
		await cms.mediaService().cleanupIfDue();
		const result = await cms.store().listMediaAssets(query);
		const mediaStore = cms.mediaStore();
		return {
			...result,
			items: result.items.map((item) => ({
				...item,
				publicUrl: item.storageKey ? mediaStore.getPublicUrl(item.storageKey) : null,
			})),
		};
	},
});

export const getMedia = defineOperation({
	name: "media.get",
	kind: "read",
	describe:
		'One media file: filename, type, size, default alt text and caption, public URL, and whether the stored file is still there (`status` "missing" when it is not).',
	input: () => z.object({ id: z.uuid().describe("The id of the media file") }),
	run: async ({ id }, { cms }) => {
		const media = await cms.store().getMediaAsset(id);
		if (!media) throw new CmsError("Media asset not found", "not_found");
		if (media.status !== "ready" || !media.storageKey) {
			return { ...media, mediaId: media.id, publicUrl: null };
		}
		const mediaStore = cms.mediaStore();
		const head = await mediaStore.headFile({ key: media.storageKey });
		return {
			...media,
			mediaId: media.id,
			status: head ? "ready" : "missing",
			publicUrl: head ? mediaStore.getPublicUrl(media.storageKey) : null,
			originalUrl: media.original?.storageKey ? mediaStore.getPublicUrl(media.original.storageKey) : null,
		};
	},
});
