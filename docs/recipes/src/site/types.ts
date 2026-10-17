import { cms } from "./monti.config";

export async function checkTypes() {
	const { items } = await cms.read.listEntries({ collection: "post" });
	const title: string | undefined = items[0]?.metadata.title;
	// @ts-expect-error "nope" is not a collection of this site
	await cms.read.listEntries({ collection: "nope" });
	return title;
}
