import { Home, listMetadata, localeOf } from "@/site/pages";

export const generateMetadata = () => listMetadata(localeOf(), "");

export default function Page() {
	return <Home locale={localeOf()} />;
}
