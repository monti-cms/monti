import { BLOCKS } from "../../../blocks/active";
import { cmsConfig } from "../../../config/resolved";
import { isCmsMediaConfigured } from "../../../container";
import {
	ALLOWED_FILE_MIME_TYPES,
	ALLOWED_IMAGE_MIME_TYPES,
	LIST_SORT_FIELDS,
	MAX_FILE_BYTES,
	MAX_MEDIA_BYTES,
	MAX_MEDIA_PIXELS,
	PAGE_SIZES,
} from "../../../core/api";
import { COLLECTION_DEFINITIONS, COLLECTIONS } from "../../../core/collections";
import { MAX_SLUG_LENGTH } from "../../../core/slug";
import { MAX_DOC_BYTES, MAX_MDX_BYTES, MAX_METADATA_BYTES } from "../../../core/snapshot";
import { pluginFeatures } from "../../../plugin/server";
import { adminRoute, json } from "../handler";

/**
 * Collection definitions (`schemas` and the summarized v1-shaped `definitions`), body block definitions (`blocks`), and server limits (§5.6 "the server config and
 * API metadata show the same limits"). The field character limit is the field's `max` in `schemas` (the title too).
 */
export const GET = adminRoute(async () => {
	// Plugin feature flags live under the plugin name (`features.ai` etc.). The config rejects plugin names that collide with core names.
	const plugins = await pluginFeatures();
	return json({
		version: "v1",
		collections: COLLECTIONS,
		definitions: COLLECTION_DEFINITIONS,
		schemas: cmsConfig.collections,
		blocks: BLOCKS,
		features: {
			folders: true,
			references: true,
			search: true,
			templates: true,
			media: isCmsMediaConfigured(),
			...plugins,
		},
		limits: {
			mdxBytes: MAX_MDX_BYTES,
			docBytes: MAX_DOC_BYTES,
			metadataBytes: MAX_METADATA_BYTES,
			slugLength: MAX_SLUG_LENGTH,
			mediaBytes: MAX_MEDIA_BYTES,
			mediaPixels: MAX_MEDIA_PIXELS,
			mediaTypes: ALLOWED_IMAGE_MIME_TYPES,
			fileBytes: MAX_FILE_BYTES,
			fileTypes: ALLOWED_FILE_MIME_TYPES,
			pageSizes: PAGE_SIZES,
			sortFields: LIST_SORT_FIELDS,
		},
	});
});
