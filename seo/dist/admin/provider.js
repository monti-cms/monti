"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { SEO_INPUTS, SEO_PREVIEW_VIEW } from "../fields.js";
import { seoDescriptionInput, seoNoindexInput, seoTitleInput } from "./inputs.js";
import { SeoPreviewView } from "./preview.js";
/** What the SEO extension adds to the admin UI: the search preview (view field) and the search title, description and hide inputs. */
export const SEO_ADMIN_COMPONENTS = {
    fieldViews: { [SEO_PREVIEW_VIEW]: SeoPreviewView },
    fieldInputs: {
        [SEO_INPUTS.title]: seoTitleInput,
        [SEO_INPUTS.description]: seoDescriptionInput,
        [SEO_INPUTS.noindex]: seoNoindexInput,
    },
};
export function SeoAdminProvider({ children }) {
    return _jsx(CmsAdminComponentsProvider, { components: SEO_ADMIN_COMPONENTS, children: children });
}
