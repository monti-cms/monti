import { Entry, entryMetadata, localeOf } from "@/site/pages";

export const generateStaticParams = async () => [];

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
	const { locale, slug } = await params;
	return entryMetadata("memo", slug, localeOf(locale));
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
	const { locale, slug } = await params;
	return <Entry collection="memo" slug={slug} locale={localeOf(locale)} />;
}
