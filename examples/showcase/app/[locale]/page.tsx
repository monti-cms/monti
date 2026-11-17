import { Home, homeMetadata, localeOf } from "@/site/pages";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
	return homeMetadata(localeOf((await params).locale));
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
	return <Home locale={localeOf((await params).locale)} />;
}
