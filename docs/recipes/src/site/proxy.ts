import { type NextRequest, NextResponse } from "next/server";
import { cms } from "./monti.config";
import { strictStatus } from "./strict-status";

export async function proxy(request: NextRequest) {
	const answer = await strictStatus(cms, request.nextUrl.pathname);
	if (answer?.status === 308) return NextResponse.redirect(new URL(answer.location, request.url), 308);
	// An unknown post: rewrite to an address no route serves, so Next shows the app's own 404 page with a real 404 status.
	if (answer?.status === 404) return NextResponse.rewrite(new URL("/no-such-page", request.url));
	return NextResponse.next();
}

// Pages only: not Next's own files, the API or files with an extension.
export const config = { matcher: ["/((?!_next/|api/|.*\\..*).*)"] };
