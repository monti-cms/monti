import { Entry, entryMetadata, localeOf } from "@/site/pages";

// No page is made at build time; each is made when it is first asked for and kept until something is published.
export const generateStaticParams = async () => [];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
	return entryMetadata("post", (await params).slug, localeOf());
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	return <Entry collection="post" slug={(await params).slug} locale={localeOf()} />;
}
