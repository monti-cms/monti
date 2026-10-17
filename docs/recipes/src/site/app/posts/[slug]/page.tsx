import { CmsContent } from "@monti-cms/core/render";
import { notFound, permanentRedirect } from "next/navigation";
import { cms } from "../../../monti.config";
import { getPost } from "../../../posts";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const found = await getPost(cms, (await params).slug);
	if (!found) notFound();
	if (found.redirectTo !== undefined) permanentRedirect(found.redirectTo);
	return <CmsContent cms={cms} entry={found.entry} />;
}
