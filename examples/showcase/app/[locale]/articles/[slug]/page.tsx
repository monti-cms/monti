import { Article, articleMetadata, localeOf } from "@/site/pages";

export const generateStaticParams = async () => [];

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
	const { locale, slug } = await params;
	return articleMetadata(slug, localeOf(locale));
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
	const { locale, slug } = await params;
	return <Article slug={slug} locale={localeOf(locale)} />;
}
