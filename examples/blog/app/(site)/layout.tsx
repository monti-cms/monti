import type { ReactNode } from "react";
import { SiteFrame } from "@/site/frame";
import { frameLocale } from "@/site/pages";

// `metadataBase`: a page's addresses (its canonical one, the other languages') are paths on this site, made whole with the site's own
// address (`SITE_URL`).
export const metadata = {
	title: { default: "Monti 블로그", template: "%s · Monti 블로그" },
	metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
};

// The pages in the source language: their addresses carry no language.
export default function Layout({ children }: { children: ReactNode }) {
	return <SiteFrame lang={frameLocale()}>{children}</SiteFrame>;
}
