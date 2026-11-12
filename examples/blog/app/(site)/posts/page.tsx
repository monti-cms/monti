import { localeOf, Posts } from "@/site/pages";

export default function Page() {
	return <Posts locale={localeOf()} />;
}
