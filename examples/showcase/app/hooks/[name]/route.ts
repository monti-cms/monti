// Two webhook receivers of the site's own, to try deliveries without another server (see `monti.config.ts`):
//   POST /hooks/ok      takes the event and keeps the last 20; GET /hooks/ok shows them
//   POST /hooks/broken  always answers 503, so its deliveries fail and wait in the activity log

type Received = { at: string; event: unknown; attempt: string | null };

// Kept on `globalThis`: the dev server reloads this module, and what it got stays.
const held = globalThis as { showcaseHooks?: Received[] };
held.showcaseHooks ??= [];
const received = held.showcaseHooks;

type Context = { params: Promise<{ name: string }> };

export async function POST(request: Request, { params }: Context) {
	const { name } = await params;
	if (name === "broken") return new Response("This hook fails on purpose.", { status: 503 });
	if (name !== "ok") return new Response(null, { status: 404 });
	received.unshift({
		at: new Date().toISOString(),
		event: await request.json(),
		attempt: request.headers.get("monti-attempt"),
	});
	received.length = Math.min(received.length, 20);
	return new Response(null, { status: 204 });
}

export async function GET(_request: Request, { params }: Context) {
	if ((await params).name !== "ok") return new Response(null, { status: 404 });
	return Response.json(received);
}
