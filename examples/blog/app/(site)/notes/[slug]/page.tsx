import { Entry, localeOf } from "@/site/pages";

export const generateStaticParams = async () => [];

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	return <Entry collection="memo" slug={(await params).slug} locale={localeOf()} />;
}
