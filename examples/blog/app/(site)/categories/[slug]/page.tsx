import { Category, localeOf } from "@/site/pages";

export const generateStaticParams = async () => [];

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	return <Category slug={(await params).slug} locale={localeOf()} />;
}
