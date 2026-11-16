"use client";

import type { LanguageLink } from "@monti-cms/next";
import { useParams } from "next/navigation";
import { Top } from "./top";

/**
 * The top line of the page that is not found. Next hands that page nothing of its address, so the language is read here, from the address's
 * first part: a language is shown in an address exactly when its first page is at `/<language>`. Anything else is the source language.
 */
export function NotFoundTop({ source, homes }: { source: string; homes: Omit<LanguageLink, "current">[] }) {
	const { locale } = useParams<{ locale?: string }>();
	const shown = homes.find((home) => home.href === `/${locale}`)?.locale ?? source;
	return (
		<Top
			home={homes.find((home) => home.locale === shown)?.href ?? "/"}
			links={homes.map((home) => ({ ...home, current: home.locale === shown }))}
		/>
	);
}
