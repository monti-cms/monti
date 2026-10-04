"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import type { ReactNode } from "react";
import { SEO_INPUTS, SEO_PREVIEW_VIEW } from "../fields";
import { seoDescriptionInput, seoNoindexInput, seoTitleInput } from "./inputs";
import { SeoPreviewView } from "./preview";

/** SEO 확장이 관리자 화면에 넣는 것: 검색 미리보기(보기 필드)와 검색 제목·설명·숨기기 입력. */
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
