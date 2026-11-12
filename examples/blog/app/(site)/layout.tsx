import type { ReactNode } from "react";
import { SiteFrame } from "@/site/frame";
import { localeOf } from "@/site/pages";

export const metadata = { title: "Monti 블로그" };

// The pages in the source language: their addresses carry no language.
export default function Layout({ children }: { children: ReactNode }) {
	return <SiteFrame lang={localeOf()}>{children}</SiteFrame>;
}
