"use client";

import { adminFetch, defineAdminPlugin, type ImageInserted } from "@monti-cms/admin";

/** `team-photo_2024.jpg` becomes "team photo 2024". */
const textOfFilename = (filename: string) =>
	filename
		.replace(/\.[a-z0-9]+$/i, "")
		.replace(/[-_]+/g, " ")
		.trim();

/** Fills an empty alt text from the file name of the library image. `fill` writes only while the field is still empty and untouched. */
const altFromFilename: ImageInserted = async ({ image, site, signal, fill }) => {
	if (!image.mediaId || image.alt || image.decorative) return;
	const media = await adminFetch<{ filename: string }>(site, `/v1/media/${encodeURIComponent(image.mediaId)}`, {
		signal,
	});
	fill({ alt: textOfFilename(media.filename) });
};

export default defineAdminPlugin({ on: { editor: { imageInserted: [altFromFilename] } } });
