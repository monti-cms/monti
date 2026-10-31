import type {
	ApiKeyList,
	BodyTemplate,
	Folder,
	FolderContents,
	FolderListItem,
	FolderTrashResult,
	IncomingReferenceItem,
	MediaTrashResult,
	PreferencesBody,
} from "@monti-cms/core/site";
import { afterEach, vi } from "vitest";
// From its own module, not the `@monti-cms/core/testing` barrel: the barrel brings the server (Postgres, AsyncLocalStorage), which cannot load in the
// browser tests (`*.browser.test.tsx`).
import { type ErrorCode, errorResponse } from "../../../core/src/http/v1/error-handler";
import type {
	BulkItemResult,
	EntriesPage,
	EntrySearchResponse,
	EntryWriteResult,
	ListCountsResponse,
} from "../api/entries";
import type { CmsIssue } from "../api/error-message";
import type { EventsList, RetryAllResult } from "../api/events";
import type { ExportFormat, ExportSummary } from "../api/export";
import type { ImportPreview, ImportRun } from "../api/import";
import type { MediaInfo, MediaPage, UploadCompletion, UploadPlan } from "../api/media";
import type { RestorePreview, RestoreRun, RestoreState } from "../api/restore";
import type { SavedSchema, SchemaEditPreview, SchemaScreenState } from "../api/schema";
import type { TrashDeleteOutcome, TrashEmptyOutcome, TrashPage, TrashRestoreOutcome } from "../api/trash";
import type { EntryData } from "../screens/entries/entry-form";

/**
 * What the admin client reads from each route, as `src/api` declares it. A handler must answer in this shape, so a fake answer that the screen code would
 * not get from the client fails the type check. A route a plugin or a test adds itself goes through `onAny`.
 */
export interface AdminRoutes {
	"GET /v1/entries": EntriesPage;
	"GET /v1/entries/search": EntrySearchResponse;
	"GET /v1/entries/counts": ListCountsResponse;
	"GET /v1/entries/:id": EntryData;
	"POST /v1/entries": EntryWriteResult;
	"PATCH /v1/entries/:id": EntryWriteResult;
	"DELETE /v1/entries/:id": undefined;
	"POST /v1/entries/:id/publish": EntryWriteResult;
	"POST /v1/entries/:id/check": { issues: CmsIssue[]; warnings: CmsIssue[] };
	"POST /v1/entries/:id/duplicate": EntryWriteResult;
	"POST /v1/entries/:id/translations": { entry: { id: string } };
	"POST /v1/entries/:id/:action": unknown;
	"GET /v1/entries/:id/relations": { incomingReferences: IncomingReferenceItem[] };
	"POST /v1/bulk": { results: BulkItemResult[] };
	"GET /v1/folders": FolderListItem[];
	"GET /v1/folders/:id/contents": FolderContents;
	"POST /v1/folders": Folder;
	"PATCH /v1/folders/:id": unknown;
	"DELETE /v1/folders/:id": FolderTrashResult;
	"GET /v1/trash": TrashPage;
	"POST /v1/trash/restore": { results: TrashRestoreOutcome[] };
	"POST /v1/trash/delete": { results: TrashDeleteOutcome[] };
	"POST /v1/trash/empty": TrashEmptyOutcome;
	"POST /v1/references/unlink": { entries: number };
	"GET /v1/media": MediaPage;
	"GET /v1/media/:id": MediaInfo;
	"PATCH /v1/media/:id": undefined;
	"POST /v1/media/trash": MediaTrashResult;
	"POST /v1/media/uploads": UploadPlan;
	"POST /v1/media/:id/complete": UploadCompletion;
	"POST /v1/media/:id/replace": UploadCompletion;
	"GET /v1/templates": { items?: BodyTemplate[] };
	"GET /v1/templates/:id": BodyTemplate;
	"POST /v1/templates": BodyTemplate;
	"PATCH /v1/templates/:id": BodyTemplate;
	"DELETE /v1/templates/:id": undefined;
	"GET /v1/events": EventsList;
	"POST /v1/events/retry": RetryAllResult;
	"POST /v1/events/:id/retry": unknown;
	"POST /v1/events/:id/dismiss": unknown;
	"GET /v1/preferences": PreferencesBody;
	"PUT /v1/preferences": unknown;
	"GET /v1/api-keys": ApiKeyList;
	"POST /v1/api-keys": unknown;
	"PATCH /v1/api-keys/:id": unknown;
	"DELETE /v1/api-keys/:id": unknown;
	"PUT /v1/api-keys/slots": unknown;
	"GET /v1/meta": { formats?: ExportFormat[]; limits?: { importBytes?: number } };
	"POST /v1/export/summary": ExportSummary;
	/** A zip and its headers: answer with `raw(new Response(…))`. */
	"POST /v1/export": never;
	"GET /v1/import/restore": RestoreState;
	"POST /v1/import/restore": RestorePreview | RestoreRun;
	"POST /v1/import/entries": ImportPreview | ImportRun;
	"GET /v1/schema": SchemaScreenState;
	"POST /v1/schema/preview": SchemaEditPreview;
	"PUT /v1/schema": SavedSchema | { saved: false; reason: "unchanged" };
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** One request the screen sent: its method, path (after `/v1`, without the query), query, JSON body (or the `FormData` of an upload) and route params. */
export interface SentRequest {
	readonly method: Method;
	readonly path: string;
	readonly query: URLSearchParams;
	// biome-ignore lint/suspicious/noExplicitAny: a test reads the fields of the body it expects.
	readonly body: any;
	readonly params: Readonly<Record<string, string>>;
}

const REPLY = Symbol("reply");
/** An answer other than the route's success body: an error of the API, or a bare status. */
export interface Reply {
	readonly [REPLY]: () => Response;
}

/** The API's error answer for `code`, with the status the real server gives that code. */
export const failure = (
	code: ErrorCode,
	message: string = code,
	extra: Parameters<typeof errorResponse>[2] = {},
): Reply => ({ [REPLY]: () => errorResponse(code, message, extra) });

/** An answer that is not JSON (the zip of an export, with its headers). */
export const raw = (response: Response): Reply => ({ [REPLY]: () => response });

/** A JSON answer with a status of the test's choosing, for an answer the API types do not name (a plugin route's error, say). */
export const answer = (status: number, body: unknown): Reply => ({ [REPLY]: () => Response.json(body, { status }) });

type Handler<T> = (request: SentRequest) => T | Reply | Promise<T | Reply>;

interface Route {
	readonly method: Method;
	readonly segments: readonly string[];
	readonly handler: Handler<unknown>;
}

const parse = (route: string): { method: Method; segments: string[] } => {
	const [method, path = ""] = route.split(" ");
	return { method: method as Method, segments: path.replace(/^\/v1/, "").split("/").filter(Boolean) };
};

/** The params of `segments` (`:id`) when the path matches, and how many segments were literal (more wins). */
const match = (route: Route, method: string, parts: readonly string[]) => {
	if (route.method !== method || route.segments.length !== parts.length) return undefined;
	const params: Record<string, string> = {};
	let literal = 0;
	for (const [index, segment] of route.segments.entries()) {
		const part = parts[index] as string;
		if (segment.startsWith(":")) params[segment.slice(1)] = decodeURIComponent(part);
		else if (segment === part) literal++;
		else return undefined;
	}
	return { params, literal };
};

const bodyOf = (body: BodyInit | null | undefined) => {
	if (typeof body === "string") return body ? JSON.parse(body) : undefined;
	return body ?? undefined;
};

/**
 * The one fake of the admin API in screen tests. A test names the routes its screen calls and what they answer, in the shape `src/api` declares; every request
 * is kept in `requests`. A request no route answers fails the test with its method and path, so a screen never runs on an answer nobody wrote.
 *
 * ```ts
 * const api = fakeApi().install();
 * api.on("GET /v1/entries/:id", ({ params }) => entry(params.id));
 * api.on("POST /v1/entries/:id/publish", () => failure("conflict"));
 * expect(api.sent("PATCH /v1/entries/:id")[0]?.body).toMatchObject({ expectedVersion: 3 });
 * ```
 *
 * A later `on` for the same route takes over, so a test can change one answer of a shared setup. Call `install` in `beforeEach`; `vi.unstubAllGlobals` removes it.
 */
export function fakeApi() {
	const routes: Route[] = [];
	const unanswered: string[] = [];
	const requests: SentRequest[] = [];

	const add = (route: string, handler: Handler<unknown>) => {
		routes.unshift({ ...parse(route), handler });
	};

	const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
		const url = new URL(String(input instanceof Request ? input.url : input), "http://localhost");
		const at = url.pathname.indexOf("/v1/");
		if (at < 0) throw new Error(`fake API: ${url.pathname} is not an API address`);
		const method = (init.method ?? "GET").toUpperCase() as Method;
		const parts = url.pathname
			.slice(at + 3)
			.split("/")
			.filter(Boolean);
		const found = routes
			.map((route) => ({ route, hit: match(route, method, parts) }))
			.filter((candidate) => candidate.hit !== undefined)
			.sort((a, b) => (b.hit?.literal ?? 0) - (a.hit?.literal ?? 0))[0];
		const request: SentRequest = {
			method,
			path: `/v1/${parts.join("/")}`,
			query: url.searchParams,
			body: bodyOf(init.body),
			params: found?.hit?.params ?? {},
		};
		requests.push(request);
		// Like the server: a write must carry a JSON body or an upload.
		const type = new Headers(init.headers).get("content-type") ?? "";
		if (
			["POST", "PUT", "PATCH"].includes(method) &&
			!type.includes("application/json") &&
			!(init.body instanceof FormData)
		)
			return errorResponse("unsupported_media_type", `${method} ${request.path} sent no JSON body`);
		if (!found) {
			unanswered.push(`${method} ${request.path}`);
			throw new Error(`fake API: no route answers ${method} ${request.path}`);
		}
		const result = await found.route.handler(request);
		if (result && typeof result === "object" && REPLY in result) return (result as Reply)[REPLY]();
		if (result === undefined) return new Response(null, { status: 204 });
		return Response.json(result);
	});

	const api = {
		/** Answers `route` (`"METHOD /v1/path/:param"`) with `handler`, in the shape the admin client reads. */
		on<K extends keyof AdminRoutes>(route: K, handler: Handler<AdminRoutes[K]>) {
			add(route, handler as Handler<unknown>);
			return api;
		},
		/** Answers a route the admin client does not declare (a plugin's or a test's own). */
		onAny(route: `${Method} /v1/${string}`, handler: Handler<unknown>) {
			add(route, handler);
			return api;
		},
		/** Answers the counts the admin frame's rail asks for (the trash and the failed deliveries) with nothing in them. */
		withEmptyRail() {
			api.on("GET /v1/trash", () => ({ items: [], total: 0, kinds: {} }));
			api.on("GET /v1/events", () => ({
				items: [],
				total: 0,
				counts: { pending: 0, delivering: 0, delivered: 0, failed: 0, dead: 0, dismissed: 0 },
			}));
			return api;
		},
		requests,
		/** The requests that matched `route`, in order: `sent("PATCH /v1/entries/:id")`. */
		sent(route: `${Method} /v1/${string}`) {
			const { method, segments } = parse(route);
			return requests.filter(
				(request) =>
					match({ method, segments, handler: () => undefined }, request.method, request.path.split("/").slice(2)) !==
					undefined,
			);
		},
		fetch,
		/** Puts this fake in place of `fetch` for the test. */
		install() {
			vi.stubGlobal("fetch", fetch);
			installed.add(unanswered);
			return api;
		},
	};
	return api;
}

export type FakeApi = ReturnType<typeof fakeApi>;

/** The unanswered requests of each installed fake. A screen often catches the failed request and shows an error, so the test would pass without this. */
const installed = new Set<string[]>();
afterEach(() => {
	const missed = [...installed].flat();
	installed.clear();
	if (missed.length > 0) throw new Error(`fake API: no route answered ${[...new Set(missed)].join(", ")}`);
});
