import { mdxAdmin } from "@monti-cms/mdx/admin";
import { AdminPage } from "@monti-cms/next/admin";
import { seoAdmin } from "@monti-cms/seo/admin";

// The admin, with the browser halves of the plugins: the SEO tab's inputs and preview, and "View as MDX".
export default function Admin() {
	return <AdminPage siteName="Monti 쇼케이스" plugins={[seoAdmin, mdxAdmin]} />;
}
