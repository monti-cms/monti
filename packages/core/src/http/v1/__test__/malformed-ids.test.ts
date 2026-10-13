import { describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../test/site";
import { fakeCms } from "../../../cms";
import * as apiKey from "../api-keys/[id]/route";
import * as publish from "../entries/[id]/publish/route";
import * as entry from "../entries/[id]/route";
import * as eventRetry from "../events/[id]/retry/route";
import * as folder from "../folders/[id]/route";
import * as mediaComplete from "../media/[id]/complete/route";
import * as media from "../media/[id]/route";
import * as template from "../templates/[id]/route";

type Handler = (request: Request, context: { params: Promise<{ id: string }>; cms: unknown }) => Promise<Response>;

const routes: Record<string, Record<string, unknown>> = {
	"entries/:id": entry,
	"entries/:id/publish": publish,
	"folders/:id": folder,
	"templates/:id": template,
	"media/:id": media,
	"media/:id/complete": mediaComplete,
	"events/:id/retry": eventRetry,
	"api-keys/:id": apiKey,
};

/** Any store call would be a malformed id reaching the database; each of these throws if it is touched. */
const untouchable = new Proxy({}, { get: () => vi.fn(() => Promise.reject(new Error("the store was reached"))) });

describe("a path id that is not a UUID", () => {
	const cms = fakeCms({ config: testConfig, store: untouchable as never });

	for (const [name, module] of Object.entries(routes)) {
		for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
			const handler = module[method] as Handler | undefined;
			if (!handler) continue;
			it(`${method} ${name} answers 404 not_found without reaching the store`, async () => {
				const request = new Request(`http://localhost/api/monti/v1/${name}?expectedVersion=1`, {
					method,
					headers: { origin: "http://localhost", "content-type": "application/json" },
					...(method === "GET" || method === "DELETE" ? {} : { body: JSON.stringify({ expectedVersion: 1 }) }),
				});
				const response = await handler(request, { params: Promise.resolve({ id: "not-a-uuid" }), cms });
				expect(response.status).toBe(404);
				expect(await response.json()).toMatchObject({ error: { code: "not_found" } });
			});
		}
	}
});
