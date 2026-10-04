import { createTranslator, SITE_NAME } from "@monti-cms/core/client";
import { isCmsMediaConfigured } from "@monti-cms/core/runtime";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { loadAdminPlugins } from "../plugins";
import { AdminFeaturesProvider } from "../screens/shared/admin-features";
import { AdminQueryProvider } from "../screens/shared/query-provider";
import { Toaster } from "../ui/sonner";
import { TooltipProvider } from "../ui/tooltip";
import { AdminThemeProvider } from "./admin-theme-provider";
import { nextMessages } from "./messages";

const t = createTranslator(nextMessages);

/** 관리자 화면 메타데이터. 앱의 관리자 레이아웃에서 `export const metadata = cmsAdminMetadata;`로 쓴다. */
export const cmsAdminMetadata: Metadata = {
	title: SITE_NAME ? t("titleWithSite", { site: SITE_NAME }) : t("title"),
	robots: { index: false, follow: false },
};

export type CmsAdminLayoutProps = {
	children: ReactNode;
	/**
	 * 관리자 화면의 테마 공급자(`next-themes`)를 둘지. 기본 `true`. 사이트가 이미 테마 공급자를 두었으면 `false`로 끈다.
	 * 이때 관리자 화면은 사이트가 `html`에 붙이는 `.dark` 또는 `[data-theme="dark"]`를 따른다.
	 */
	themeProvider?: boolean;
	/**
	 * 관리자 화면의 알림 창(`sonner`의 `Toaster`)을 둘지. 기본 `true`. 사이트가 이미 `Toaster`를 두었으면 `false`로 끈다.
	 * 관리자 화면의 알림은 사이트의 `Toaster`에도 뜬다(같은 `sonner` 패키지를 쓸 때).
	 */
	toaster?: boolean;
};

/**
 * 관리자 화면 레이아웃. 앱의 `app/(admin)/admin/layout.tsx`가 그린다. 스타일(Tailwind·`cms-*` 색)은 앱의 전역 CSS가 준다.
 * 밝은·어두운 테마를 모두 지원하고(v1 §3.1) 기본으로 `next-themes` 공급자와 알림 창을 둔다.
 * 사이트가 이미 둔 것이 있으면 `<CmsAdminLayout themeProvider={false} toaster={false}>`로 끈다.
 */
export async function CmsAdminLayout({ children, themeProvider = true, toaster = true }: CmsAdminLayoutProps) {
	const plugins = await loadAdminPlugins();
	// 플러그인 공급자는 서버 데이터 캐시 안에서, 등록 순서대로 바깥부터 감싼다.
	const content = plugins.reduceRight<ReactNode>(
		(inner, { name, Provider }) => (Provider ? <Provider key={name}>{inner}</Provider> : inner),
		<TooltipProvider>
			<div className="cms-admin min-h-screen bg-cms-background text-cms-foreground">{children}</div>
			{toaster ? <Toaster richColors closeButton position="bottom-right" /> : null}
		</TooltipProvider>,
	);
	const app = (
		<AdminQueryProvider>
			<AdminFeaturesProvider features={{ media: isCmsMediaConfigured() }}>{content}</AdminFeaturesProvider>
		</AdminQueryProvider>
	);
	return themeProvider ? <AdminThemeProvider>{app}</AdminThemeProvider> : app;
}
