import { previewEntry } from "@monti-cms/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PostView } from "@/components/post-view";
import { cms } from "@/monti.config";

// The draft preview of a post: the same page over the draft the admin is editing. The address is `site.previewPath` (`/preview`) plus the post's public path
// (`/ko/posts/<slug>`). It shows only to a signed-in admin (under `next dev` that is you, so the editor's Preview button works with no login) and is a 404 for
// everyone else. It reads the draft of the signed-in admin, so it is never cached.
export const instant = false;

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function PostPreviewPage({ params }: Props) {
	await connection();
	const { locale, slug } = await params;
	if (!cms.site.isLocale(locale)) notFound();
	// `previewEntry` attaches the request headers first, so the admin session is read even on the first request after a cold start. Anyone else gets a 404.
	const draft = await previewEntry(cms, { collection: "post", slug: decodeURIComponent(slug), locale });
	if (!draft) notFound();
	return <PostView entry={draft} />;
}

/** A preview is never indexed. */
export const generateMetadata = async (): Promise<Metadata> => ({ robots: { index: false, follow: false } });
