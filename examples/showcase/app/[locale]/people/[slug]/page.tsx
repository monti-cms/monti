import { localeOf, Person } from "@/site/pages";

export const generateStaticParams = async () => [];

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
	const { locale, slug } = await params;
	return <Person slug={slug} locale={localeOf(locale)} />;
}
