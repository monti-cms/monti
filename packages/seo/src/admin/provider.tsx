"use client";

import type { AdminComponents } from "@monti-cms/admin";
import { SEO_INPUTS } from "../fields";
import { seoDescriptionInput, seoImageInput, seoTitleInput } from "./inputs";

/** What the SEO extension adds to the admin UI: the search title, description and share image pieces (what each reads while empty, the character counts). */
export const SEO_ADMIN_COMPONENTS: AdminComponents = {
	fieldInputs: {
		[SEO_INPUTS.title]: seoTitleInput,
		[SEO_INPUTS.description]: seoDescriptionInput,
		[SEO_INPUTS.image]: seoImageInput,
	},
};
