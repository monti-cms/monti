import type { ReactNode } from "react";
import { SiteFrame } from "@/site/frame";
import { frameLocale } from "@/site/pages";

// `metadataBase`: a page's addresses (its canonical one, the other languages', the share image's) are paths on this site, made whole with it.
export const metadata = {
	title: { default: "Monti showcase", template: "%s · Monti showcase" },
	metadataBase: new URL(process.env.SHOWCASE_URL ?? "http://localhost:3000"),
};

// The pages in the source language: their addresses carry no language.
export default function Layout({ children }: { children: ReactNode }) {
	return <SiteFrame lang={frameLocale()}>{children}</SiteFrame>;
}
