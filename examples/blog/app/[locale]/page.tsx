import { Home, listMetadata, localeOf } from "@/site/pages";

export const generateStaticParams = async () => [];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
	return listMetadata(localeOf((await params).locale), "");
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
	return <Home locale={localeOf((await params).locale)} />;
}
