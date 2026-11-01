import { describe, expect, it } from "vitest";
import { contentCollection, defaultLocale } from "../../../test/any-site";
import { testConfig } from "../../../test/site";
import { docOf } from "../../../test/stored-content";
import type { AuthContext } from "../../adapters/auth";
import { fakeCms } from "../../cms";
import { defineFormat } from "../../format/types";

const admin: AuthContext = { userId: "u", accountId: "123", isAdmin: true, name: "Admin" };
const id = "00000000-0000-4000-8000-000000000021";

/** A format that only writes, and writes how many blocks a document has. */
const blockCount = defineFormat({
	name: "block-count",
	label: "Block count",
	mimeType: "text/plain",
	extension: "out",
	export: (document) => `${document.content.length} blocks`,
});

describe("entries.get", () => {
	it("FMT-P3 with a format, adds the draft and the published body as text, also in a format that only writes", async () => {
		const entry = {
			id,
			translationGroupId: id,
			collection: contentCollection,
			locale: defaultLocale,
			working: { doc: docOf("One\n\nTwo") },
			published: { doc: docOf("One") },
		};
		const cms = fakeCms({
			config: testConfig,
			store: {
				getEntry: async () => entry as never,
				getTranslationGroup: async () => ({ groupId: id, members: [] }),
			},
			formats: [blockCount],
		});

		const read = (await cms.runOperation("entries.get", { id, format: "block-count" }, { auth: admin })) as {
			working: { body?: string };
			published: { body?: string };
		};

		expect(read.working.body).toBe("2 blocks");
		expect(read.published.body).toBe("1 blocks");
	});
});
