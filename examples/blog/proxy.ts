import { type NextRequest, NextResponse } from "next/server";
import { postStatus } from "@/components/monti/blog-theme/blog-proxy";

// The status of a post address is decided here, before the page streams: a real 404 or 308 (see blog-proxy.ts). With cacheComponents a page cannot do it itself.
export async function proxy(request: NextRequest) {
	const routes = [
		{ collection: "post", routeBase: "/posts" },
		{ collection: "memo", routeBase: "/memos" },
	];
	for (const route of routes) {
		const response = await postStatus(request, route);
		if (response) return response;
	}
	return NextResponse.next();
}

// Pages only: not Next's own files, the API or files with an extension.
export const config = { matcher: ["/((?!_next/|api/|.*\\..*).*)"] };
