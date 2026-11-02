import { z } from "zod";
import { CmsError } from "../../core/store/errors";
import { defineOperation, type OperationContext, type WritePlan } from "../define";
import { spotBase } from "./base";

const mediaId = z.uuid().describe("The id of a media file");

type MediaText = "defaultAlt" | "defaultCaption";

async function liveMedia(context: OperationContext, id: string) {
	const media = await context.cms.store().getMediaAsset(id);
	if (!media || media.deletedAt) throw new CmsError(`Media file ${id} is gone or in the trash`, "not_found");
	return media;
}

const textOf = (media: { defaultAlt?: string | null; defaultCaption?: string | null }, spot: MediaText) =>
	media[spot] ?? null;

/** Sets the default alt text or caption of media files. One change per file and text, so each can be reviewed and undone on its own. */
export const updateMediaText = defineOperation({
	name: "media.updateText",
	kind: "write",
	describe:
		"Propose the default alt text and/or caption of media files. Nothing changes until the admin applies it. Look at the image (media.get) before writing " +
		"its alt text; write what the image shows, plainly, in the site's language.",
	input: () =>
		z.object({
			items: z
				.array(
					z.object({
						id: mediaId,
						alt: z.string().max(1000).optional(),
						caption: z.string().max(1000).optional(),
					}),
				)
				.min(1)
				.max(100),
		}),
	plan: async ({ items }, context) => {
		const plans: WritePlan[] = [];
		for (const item of items) {
			const media = await liveMedia(context, item.id);
			for (const [spot, after] of [
				["defaultAlt", item.alt],
				["defaultCaption", item.caption],
			] as const) {
				if (after === undefined) continue;
				const before = textOf(media, spot);
				if (before === after) continue;
				plans.push({
					target: { kind: "media", id: item.id, spot },
					preview: { before, after },
					base: spotBase(before),
					change: { spot, value: after },
					subject: { title: media.filename },
				});
			}
		}
		return plans;
	},
	apply: async (plan, context) => {
		const { spot, value } = plan.change as { spot: MediaText; value: string };
		const media = await liveMedia(context, plan.target.id);
		const before = textOf(media, spot);
		if (spotBase(before) !== plan.base) throw new CmsError("The text changed since", "conflict");
		await context.cms.store().updateMediaMetadata({ id: plan.target.id, [spot]: value });
		return { base: spotBase(value), undo: { value: before } };
	},
	revert: async (plan, undo, context) => {
		const { spot } = plan.change as { spot: MediaText };
		await context.cms
			.store()
			.updateMediaMetadata({ id: plan.target.id, [spot]: (undo as { value: string | null }).value ?? "" });
	},
	baseOf: async (target, context) => {
		const media = await context.cms.store().getMediaAsset(target.id);
		if (!media || media.deletedAt || !target.spot) return null;
		return spotBase(textOf(media, target.spot as MediaText));
	},
});

const TRASH_BASE = { live: spotBase("live"), trashed: spotBase("trashed") };

/** Moves media files to the trash. A file that is in use stays where it is (the change fails with a reason). Undoing restores it. */
export const trashMedia = defineOperation({
	name: "media.trash",
	kind: "write",
	describe:
		"Propose moving media files to the trash, only when the admin asked for it. A file still used by an entry stays. Nothing changes until the admin " +
		"applies it, and it can be undone. Never propose this on your own; deleting for good is not possible.",
	input: () => z.object({ ids: z.array(mediaId).min(1).max(100) }),
	plan: async ({ ids }, context) => {
		const plans: WritePlan[] = [];
		for (const id of ids) {
			const media = await liveMedia(context, id);
			plans.push({
				target: { kind: "media", id, spot: "trash" },
				preview: { before: "live", after: "trash" },
				base: TRASH_BASE.live,
				change: {},
				subject: { title: media.filename },
			});
		}
		return plans;
	},
	apply: async (plan, context) => {
		await liveMedia(context, plan.target.id).catch(() => {
			throw new CmsError("The file is gone or already in the trash", "conflict");
		});
		const { kept } = await context.cms.trashService().trashMedia([plan.target.id]);
		if (kept.includes(plan.target.id)) throw new CmsError("The file is in use", "in_use");
		return { base: TRASH_BASE.trashed, undo: {} };
	},
	revert: async (plan, _undo, context) => {
		const [result] = await context.cms.trashService().restore([{ type: "media", id: plan.target.id }]);
		if (!result?.ok) throw new CmsError(`Could not restore media file ${plan.target.id}`, "conflict");
	},
	baseOf: async (target, context) => {
		const media = await context.cms.store().getMediaAsset(target.id);
		if (!media) return null;
		return media.deletedAt ? TRASH_BASE.trashed : TRASH_BASE.live;
	},
});
