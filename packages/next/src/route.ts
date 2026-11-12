import { createAdminApi, type Monti, readPreviewToken, syncSchemaFile } from "@monti-cms/core";
import { cookies, draftMode } from "next/headers";

/** The cookie the preview's ticket rides in while draft mode is on: the site's pages read the working copy with it (doc 16). */
export const PREVIEW_COOKIE = "monti_preview";
const PREVIEW_SECONDS = 3600;

const text = (status: number, body: string) =>
	new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** A path of this site, and nothing that leaves it (`//host`, `/\host`, a full address): the preview never sends the browser elsewhere. */
export const localPath = (value: string | null): string | null =>
	value && /^\/(?![/\\])/.test(value) && !value.includes("\\") ? value : null;

/**
 * What the server says once, when the admin API is first called (doc 16, doc 01): the dev server follows a schema file edited by hand, the live
 * site only says what to run. Not when the server starts: a site builds with no database around.
 */
export async function startUp(monti: Monti, log: (line: string) => void = console.log): Promise<void> {
	try {
		const result = await syncSchemaFile(monti);
		if (result.status === "applied")
			log(`Monti: the schema file changed; the database follows it now (${result.changeId}).`);
		else if (result.status === "review")
			log("Monti: the schema file changed in a way that touches stored values. Review it in the admin's settings.");
		else if (result.status === "migrate") log("Monti: the database is behind the schema. Run `monti db:migrate`.");
		else if (result.status === "fresh") log("Monti: the database is not set up. Run `monti db:setup`.");
	} catch (error) {
		log(
			`Monti: the database could not be read (${error instanceof Error ? error.message : String(error)}). Run \`monti db:setup\` on a new database.`,
		);
	}
}

type Handler = (request: Request) => Promise<Response>;

/**
 * The admin API as a Next route (`app/admin/api/[...path]/route.ts`, doc 16): every operation, the file routes and the GitHub sign-in of the core's
 * admin API, and the two addresses that turn the preview on and off.
 */
export function adminRoute(monti: Monti): Record<"GET" | "POST" | "PUT", Handler> {
	const api = createAdminApi(monti);
	let started: Promise<void> | null = null;

	/** "Preview" in the editor opens this: a good ticket turns draft mode on and goes to the entry's page, which then reads the working copy. */
	async function enterPreview(url: URL): Promise<Response> {
		const token = url.searchParams.get("token");
		const path = localPath(url.searchParams.get("path"));
		if (!path) return text(400, "The preview needs a path of this site.");
		const secret = monti.site.secret;
		if (!token || !secret || !(await readPreviewToken(secret, token, monti.now())))
			return text(401, "This preview link is no longer good. Open the preview again from the editor.");
		(await draftMode()).enable();
		(await cookies()).set(PREVIEW_COOKIE, token, {
			httpOnly: true,
			sameSite: "lax",
			secure: url.protocol === "https:",
			path: "/",
			maxAge: PREVIEW_SECONDS,
		});
		return new Response(null, { status: 307, headers: { location: path } });
	}

	/** "Exit" on the preview's bar: draft mode off, the ticket gone, back to the page that was open (as the site shows it now). */
	async function exitPreview(request: Request, url: URL): Promise<Response> {
		(await draftMode()).disable();
		(await cookies()).delete(PREVIEW_COOKIE);
		const referer = request.headers.get("referer");
		let back: string | null = null;
		try {
			const from = referer ? new URL(referer) : null;
			if (from && from.origin === url.origin) back = localPath(`${from.pathname}${from.search}`);
		} catch {
			back = null;
		}
		return new Response(null, {
			status: 307,
			headers: { location: localPath(url.searchParams.get("path")) ?? back ?? "/" },
		});
	}

	const handle: Handler = async (request) => {
		started ??= startUp(monti);
		await started;
		const url = new URL(request.url);
		if (request.method === "GET" && url.pathname.endsWith("/preview/exit")) return exitPreview(request, url);
		if (request.method === "GET" && url.pathname.endsWith("/preview")) return enterPreview(url);
		return api(request);
	};
	return { GET: handle, POST: handle, PUT: handle };
}
