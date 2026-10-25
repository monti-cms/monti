import { z } from "zod";
import { mediaListQuerySchema } from "../../core/api";
import { CmsError } from "../../core/store/errors";
import { defineOperation } from "../define";

export const listMedia = defineOperation({
	name: "media.list",
	kind: "read",
	describe:
		'The media library, newest upload first. Filter by filename (`search`), image or file (`kind`), folder, upload date, and `used`: "unused" finds files nothing refers to. ' +
		"Each item has its filename, type, size, public URL and where it is used.",
	input: () => mediaListQuerySchema,
	run: async (query, { cms }) => {
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
