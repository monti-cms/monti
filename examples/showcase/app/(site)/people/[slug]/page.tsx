import { localeOf, Person, personMetadata } from "@/site/pages";

// No page is made at build time; each is made when it is first asked for and kept until something is published.
export const generateStaticParams = async () => [];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
	return personMetadata((await params).slug, localeOf());
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	return <Person slug={(await params).slug} locale={localeOf()} />;
}
