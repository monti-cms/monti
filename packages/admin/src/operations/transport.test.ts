import { afterEach, describe, expect, it, vi } from "vitest";
import { httpStreams, httpTransport, NO_ANSWER } from "./transport";

afterEach(() => vi.unstubAllGlobals());

describe("the admin API over HTTP when the network is down", () => {
	it("a call that gets no answer is answered as a refusal with its own words, not thrown: whoever waits on it is told", async () => {
		vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
		const answer = await httpTransport("/admin/api")("conversations.get", { id: "c1" });
		expect(answer).toEqual(NO_ANSWER);
		expect(answer).toMatchObject({ status: 0, body: { reason: { key: "errors.noAnswer" } } });
	});

	it("a stream that cannot begin is answered the same way", async () => {
		vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
		expect(await httpStreams("/admin/api")("assistant.run", { resume: "r1" })).toEqual(NO_ANSWER);
	});
});
