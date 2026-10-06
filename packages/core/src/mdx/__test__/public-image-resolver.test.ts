import { describe, expect, it } from "vitest";
import { createPublicImageResolver } from "../public-media";

/** Stores that do not exist, as in a deployment with no database or media storage. */
const noStores = {
	store: () => {
		throw new Error("no database");
	},
	mediaStore: () => {
		throw new Error("no media storage");
	},
};

describe("createPublicImageResolver", () => {
	it("external addresses use the existing allow rules as they are", async () => {
		const resolve = await createPublicImageResolver(noStores, '::image{src="/images/a.png"}');

		expect(resolve({ src: "/images/a.png" })).toEqual({ url: "/images/a.png" });
		expect(resolve({ src: "javascript:alert(1)" })).toEqual({ failure: "rejected" });
	});

	it("returns a failure result when the media storage cannot be resolved", async () => {
		const resolve = await createPublicImageResolver(
			noStores,
			'::image{mediaId="00000000-0000-0000-0000-000000000000"}',
		);

		expect(resolve({ mediaId: "00000000-0000-0000-0000-000000000000" })).toEqual({ failure: "unresolved" });
	});
});
