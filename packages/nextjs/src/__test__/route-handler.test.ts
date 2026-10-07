// @vitest-environment node

import { fakeCms } from "@monti-cms/core/testing";
import { describe, expect, it } from "vitest";
import { createRouteHandler } from "..";
import { nextHost } from "../auth/host";

const cms = fakeCms({ store: { getPreferences: async () => null } });

describe("createRouteHandler", () => {
	it("serves the path segments Next split, for each HTTP method the API uses", async () => {
		const handler = createRouteHandler(cms);
		expect(Object.keys(handler).sort()).toEqual(["DELETE", "GET", "PATCH", "POST", "PUT"]);
		const response = await handler.GET(new Request("http://localhost/api/cms/v1/preferences"), {
			params: Promise.resolve({ path: ["v1", "preferences"] }),
		});
		expect(response.status).toBe(200);
	});

	it("answers 404 for an unknown path and 405 for a known path with another method", async () => {
		const handler = createRouteHandler(cms);
		const unknown = await handler.GET(new Request("http://localhost/api/cms/v1/nope"), {
			params: Promise.resolve({ path: ["v1", "nope"] }),
		});
		expect(unknown.status).toBe(404);
		const wrongMethod = await handler.DELETE(
			new Request("http://localhost/api/cms/v1/preferences", {
				method: "DELETE",
				headers: { origin: "http://localhost" },
			}),
			{ params: Promise.resolve({ path: ["v1", "preferences"] }) },
		);
		expect(wrongMethod.status).toBe(405);
	});

	it("attaches the Next request headers to the instance, so the config needs no host", () => {
		const attached: unknown[] = [];
		createRouteHandler({ handle: cms.handle, attachHost: (host) => attached.push(host) });
		expect(attached).toEqual([nextHost]);
	});
});
