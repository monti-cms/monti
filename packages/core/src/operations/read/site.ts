import { z } from "zod";
import { hostOf } from "../../cms/host";
import { LIST_SORT_FIELDS, PAGE_SIZES } from "../../core/api";
import { MAX_DOC_BYTES, MAX_IMPORT_BYTES, MAX_METADATA_BYTES, MAX_TEXT_BYTES } from "../../core/limits";
import { MAX_SLUG_LENGTH } from "../../core/slug";
import { readSchemaScreen } from "../../schema-edit";
import { defineOperation } from "../define";

export const describeSite = defineOperation({
	name: "site.describe",
	kind: "read",
	describe:
		"The shape of this site: its collections with their fields, the body blocks, the body formats, which features are on (folders, media, templates, plugins) and the limits. " +
		"Read it first in a run, so you know the collection and field names the other operations take.",
	input: () => z.object({}),
	run: async (_input, { cms }) => {
		// Plugin feature flags live under the plugin name (`features.ai` etc.). The config rejects plugin names that collide with core names.
		const plugins = await hostOf(cms).pluginFeatures();
		return {
			version: "v1",
			collections: cms.site.COLLECTIONS,
			definitions: cms.site.COLLECTION_DEFINITIONS,
			schemas: cms.site.config.collections,
			blocks: cms.site.BLOCKS,
			// The formats a body can be read and written in (the `format` option): the built-in ones and those plugins add.
			formats: (await cms.formats()).info(),
			// What this site offers, from its config. Which collections use folders is `definitions[name].folders`; `folders` says whether any does.
			features: {
				folders: cms.site.COLLECTIONS.some((collection) => cms.site.foldersEnabled(collection)),
				references: true,
				search: true,
				templates: cms.site.ADMIN_TEMPLATES,
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
				importBytes: MAX_IMPORT_BYTES,
				pageSizes: PAGE_SIZES,
				sortFields: LIST_SORT_FIELDS,
			},
		};
	},
});

export const readSchema = defineOperation({
	name: "schema.read",
	kind: "read",
	describe:
		"The schema file of the site (its source text and hash) and whether it can be edited here. Use it to see how collections and fields are defined; site.describe is the shorter summary.",
	input: () => z.object({}),
	run: (_input, { cms }) => readSchemaScreen(cms),
});
