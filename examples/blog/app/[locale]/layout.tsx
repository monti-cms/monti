import type { ReactNode } from "react";
import { SiteFrame } from "@/site/frame";
import { localeOf } from "@/site/pages";

export const metadata = { title: "Monti 블로그" };

// The translations' pages: `/en/…`, `/ja/…`. A language the site does not have is not found.
export default async function Layout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ locale: string }>;
}) {
	return <SiteFrame lang={localeOf((await params).locale)}>{children}</SiteFrame>;
}
