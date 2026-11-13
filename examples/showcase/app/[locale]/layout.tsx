import type { ReactNode } from "react";
import { SiteFrame } from "@/site/frame";
import { localeOf } from "@/site/pages";

// `metadataBase`: the share image's address is the storage's path on this site, made whole for `og:image`.
export const metadata = {
	title: "Monti showcase",
	metadataBase: new URL(process.env.SHOWCASE_URL ?? "http://localhost:3000"),
};

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
