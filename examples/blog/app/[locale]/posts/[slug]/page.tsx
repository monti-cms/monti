import { Entry, localeOf } from "@/site/pages";

export const generateStaticParams = async () => [];

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
	const { locale, slug } = await params;
	return <Entry collection="post" slug={slug} locale={localeOf(locale)} />;
}
