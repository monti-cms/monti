import type { ReactNode } from "react";
import { SiteFrame } from "@/site/frame";
import { localeOf } from "@/site/pages";

// `metadataBase`: the share image's address is the storage's path on this site, made whole for `og:image`.
export const metadata = {
	title: "Monti showcase",
	metadataBase: new URL(process.env.SHOWCASE_URL ?? "http://localhost:3000"),
};

// The pages in the source language: their addresses carry no language.
export default function Layout({ children }: { children: ReactNode }) {
	return <SiteFrame lang={localeOf()}>{children}</SiteFrame>;
}
