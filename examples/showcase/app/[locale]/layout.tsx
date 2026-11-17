import type { ReactNode } from "react";
import { SiteFrame } from "@/site/frame";
import { frameLocale } from "@/site/pages";

// `metadataBase`: a page's addresses (its canonical one, the other languages', the share image's) are paths on this site, made whole with it.
export const metadata = {
	title: { default: "Monti showcase", template: "%s · Monti showcase" },
	metadataBase: new URL(process.env.SHOWCASE_URL ?? "http://localhost:3000"),
};

// The translations' pages: `/en/…`, `/ja/…`. A language the site does not have is not found, which the page under this says (`localeOf`):
// the layout draws the frame the "not found" page stands in.
export default async function Layout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ locale: string }>;
}) {
	return <SiteFrame lang={frameLocale((await params).locale)}>{children}</SiteFrame>;
}
