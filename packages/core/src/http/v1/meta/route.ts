import { LIST_SORT_FIELDS, PAGE_SIZES } from "../../../core/api";
import { MAX_DOC_BYTES, MAX_METADATA_BYTES, MAX_TEXT_BYTES } from "../../../core/limits";
import { MAX_SLUG_LENGTH } from "../../../core/slug";
import { adminRoute, json } from "../handler";

/**
 * Collection definitions (`schemas` and the summarized v1-shaped `definitions`), body block definitions (`blocks`), and server limits (§5.6 "the server config and
 * API metadata show the same limits"). The field character limit is the field's `max` in `schemas` (the title too).
 */
export const GET = adminRoute(async ({ cms }) => {
	// Plugin feature flags live under the plugin name (`features.ai` etc.). The config rejects plugin names that collide with core names.
	const plugins = await cms.pluginFeatures();
	return json({
		version: "v1",
		collections: cms.site.COLLECTIONS,
		definitions: cms.site.COLLECTION_DEFINITIONS,
		schemas: cms.site.config.collections,
		blocks: cms.site.BLOCKS,
		// The formats a body can be read and written in (the `format` option): the built-in ones and those plugins add.
		formats: (await cms.formats()).info(),
		features: {
			folders: true,
			references: true,
			search: true,
			templates: true,
			media: cms.isMediaConfigured,
			...plugins,
		},
		limits: {
			textBytes: MAX_TEXT_BYTES,
			docBytes: MAX_DOC_BYTES,
			metadataBytes: MAX_METADATA_BYTES,
			slugLength: MAX_SLUG_LENGTH,
			mediaBytes: cms.site.api.MAX_MEDIA_BYTES,
			mediaPixels: cms.site.api.MAX_MEDIA_PIXELS,
			mediaTypes: cms.site.api.ALLOWED_IMAGE_MIME_TYPES,
			fileBytes: cms.site.api.MAX_FILE_BYTES,
			fileTypes: cms.site.api.ALLOWED_FILE_MIME_TYPES,
			pageSizes: PAGE_SIZES,
			sortFields: LIST_SORT_FIELDS,
		},
	});
});
