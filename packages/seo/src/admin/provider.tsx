"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import type { ReactNode } from "react";
import { SEO_INPUTS, SEO_PREVIEW_VIEW } from "../fields";
import { seoDescriptionInput, seoNoindexInput, seoTitleInput } from "./inputs";
import { SeoPreviewView } from "./preview";

/** What the SEO extension adds to the admin UI: the search preview (view field) and the search title, description and hide inputs. */
export const SEO_ADMIN_COMPONENTS: CmsAdminComponents = {
	fieldViews: { [SEO_PREVIEW_VIEW]: SeoPreviewView },
	fieldInputs: {
		[SEO_INPUTS.title]: seoTitleInput,
		[SEO_INPUTS.description]: seoDescriptionInput,
		[SEO_INPUTS.noindex]: seoNoindexInput,
	},
};

export function SeoAdminProvider({ children }: { readonly children: ReactNode }) {
	return <CmsAdminComponentsProvider components={SEO_ADMIN_COMPONENTS}>{children}</CmsAdminComponentsProvider>;
}
