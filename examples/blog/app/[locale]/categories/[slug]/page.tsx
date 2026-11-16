import { Category, entryMetadata, localeOf } from "@/site/pages";

export const generateStaticParams = async () => [];

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
	const { locale, slug } = await params;
	return entryMetadata("category", slug, localeOf(locale));
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
	const { locale, slug } = await params;
	return <Category slug={slug} locale={localeOf(locale)} />;
}
