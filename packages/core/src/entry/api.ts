import { z } from "zod";
import type { Monti } from "../monti";
import { describeError } from "./errors";

export type AdminApiOptions = {
	/** Whether the request comes from the signed-in admin (doc 15). A request that does not gets 401. */
	authenticate: (request: Request) => Promise<boolean>;
};

const Body = z.object({ input: z.unknown().optional(), versions: z.record(z.string(), z.number()).optional() });

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * The admin API: one route per operation, `POST …/operations/<name>` with `{ input, versions }`, made from the operation list. Nothing here is
 * written per operation. It takes a web `Request`, so any framework can mount it.
 */
export function createAdminApi(monti: Monti, options: AdminApiOptions) {
	return async (request: Request): Promise<Response> => {
		const match = new URL(request.url).pathname.match(/\/operations\/([\w.]+)$/);
		if (!match || request.method !== "POST") return json(404, { error: "not-found" });
		if (!(await options.authenticate(request))) return json(401, { error: "unauthenticated" });
		const body = Body.safeParse(await request.json().catch(() => null));
		if (!body.success) return json(400, { error: "invalid-body" });
		try {
			return json(
				200,
				await monti.run(match[1], body.data.input ?? {}, { actor: "admin", versions: body.data.versions }),
			);
		} catch (error) {
			const described = describeError(error);
			if (described) return json(described.status, described.body);
			throw error;
		}
	};
}
