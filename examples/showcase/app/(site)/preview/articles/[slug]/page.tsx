import { ArticlePreview, localeOf } from "@/site/pages";

// No page is made at build time; each is made when it is first asked for and kept until something is published.
export const generateStaticParams = async () => [];

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	return <ArticlePreview slug={(await params).slug} locale={localeOf()} />;
}
