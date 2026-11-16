import { Home, homeMetadata, localeOf } from "@/site/pages";

export const generateMetadata = () => homeMetadata(localeOf());

export default function Page() {
	return <Home locale={localeOf()} />;
}
