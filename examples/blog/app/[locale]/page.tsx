import { Home, localeOf } from "@/site/pages";

export const generateStaticParams = async () => [];

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
	return <Home locale={localeOf((await params).locale)} />;
}
