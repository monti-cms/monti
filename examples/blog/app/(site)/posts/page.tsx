import { listMetadata, localeOf, Posts } from "@/site/pages";

export const generateMetadata = () => listMetadata(localeOf(), "/posts");

export default function Page() {
	return <Posts locale={localeOf()} />;
}
