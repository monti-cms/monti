import { listMetadata, localeOf, Posts } from "@/site/pages";

export const generateStaticParams = async () => [];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
	return listMetadata(localeOf((await params).locale), "/posts");
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
	return <Posts locale={localeOf((await params).locale)} />;
}
