import { localeOf, Posts } from "@/site/pages";

export const generateStaticParams = async () => [];

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
	return <Posts locale={localeOf((await params).locale)} />;
}
