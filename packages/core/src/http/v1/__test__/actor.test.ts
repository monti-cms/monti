import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../../test/any-site";
import { testConfig } from "../../../../test/site";
import type { AuthContext } from "../../../adapters/auth";
import { fakeCms } from "../../../cms";
import { actorOf, currentActor } from "../../../core/actor";
import { PATCH as patchEntry } from "../entries/[id]/route";

const ID = "11111111-1111-4111-8111-111111111111";

/** The actor the store would record while the PATCH route saves a draft as `auth`. */
async function actorWhileSaving(auth: AuthContext): Promise<string | null> {
	let seen: string | null | undefined;
	const cms = fakeCms({
		config: testConfig,
		store: {
			getEntry: async () =>
				({
					id: ID,
					collection: contentCollection,
					version: 1,
					workingSlug: "a",
					working: { metadata: { title: "T" }, doc: { type: "doc", version: 3, content: [] } },
				}) as never,
		},
		contentService: {
			saveDraft: async () => {
				seen = currentActor();
				return { id: ID, version: 2 } as never;
			},
		},
		verifyAdmin: async () => auth,
	});
	const response = await patchEntry(
		new Request(`http://localhost/api/cms/v1/entries/${ID}`, {
			method: "PATCH",
			headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
			body: JSON.stringify({ expectedVersion: 1, metadata: { title: "T2" } }),
		}),
		{ params: Promise.resolve({ id: ID }), cms },
	);
	expect(response.status).toBe(200);
	return seen ?? null;
}

describe("the admin who makes a change", () => {
	it("is the name the login method gave, while the route runs", async () => {
		expect(await actorWhileSaving({ userId: "u", accountId: "123", isAdmin: true, name: "Mina Park" })).toBe(
			"Mina Park",
		);
	});

	it("is the account ID when the login method gave no name", async () => {
		expect(await actorWhileSaving({ userId: "u", accountId: "123", isAdmin: true })).toBe("123");
	});

	it("is not known outside a request", () => {
		expect(currentActor()).toBeNull();
	});

	it("names an admin by name, else by account ID", () => {
		expect(actorOf({ name: "  ", accountId: "9" })).toBe("9");
		expect(actorOf({ name: " Joon ", accountId: "9" })).toBe("Joon");
	});
});
