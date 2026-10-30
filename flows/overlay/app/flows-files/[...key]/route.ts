import { getFile, putFile } from "../../../flows-storage";

/** The flows storage's files (`flows-storage.ts`): the browser uploads with PUT and the pages read with GET. Only in the flows' app copy. */
type Context = { params: Promise<{ key: string[] }> };

export async function PUT(request: Request, { params }: Context) {
	const { key } = await params;
	await putFile(
		key.join("/"),
		await request.arrayBuffer(),
		request.headers.get("content-type") ?? "application/octet-stream",
	);
	return new Response(null, { status: 200, headers: { ETag: `"${Date.now()}"` } });
}

export async function GET(_request: Request, { params }: Context) {
	const { key } = await params;
	const file = await getFile(key.join("/"));
	if (!file) return new Response("Not found", { status: 404 });
	return new Response(file.body, { headers: { "Content-Type": file.contentType } });
}
