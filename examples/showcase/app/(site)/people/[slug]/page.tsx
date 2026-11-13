import { localeOf, Person } from "@/site/pages";

// No page is made at build time; each is made when it is first asked for and kept until something is published.
export const generateStaticParams = async () => [];

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	return <Person slug={(await params).slug} locale={localeOf()} />;
}
