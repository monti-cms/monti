import { afterEach, describe, expect, it } from "vitest";
import { openMonti } from "./config";
import { defineSchema } from "./schema/define";

const schema = defineSchema({
	locales: { source: "en", list: [{ code: "en", name: "English" }], prefix: "never" },
	collections: {},
});

/** A site opened from its config; no query is made, so the address need not answer. */
async function secretOf(config: { secret?: string }) {
	const monti = openMonti({ schema, database: "postgres://localhost/none", dev: false, ...config }, "/nowhere");
	const { secret } = monti.site;
	await monti.db.destroy();
	return secret;
}

describe("the site's secret, from its config or MONTI_SECRET", () => {
	const before = process.env.MONTI_SECRET;
	afterEach(() => {
		if (before === undefined) delete process.env.MONTI_SECRET;
		else process.env.MONTI_SECRET = before;
	});

	it("14-4 a blank secret in the config does not hide MONTI_SECRET (review L)", async () => {
		process.env.MONTI_SECRET = "from-the-environment";
		expect(await secretOf({ secret: "   " })).toBe("from-the-environment");
		expect(await secretOf({ secret: "" })).toBe("from-the-environment");
		expect(await secretOf({})).toBe("from-the-environment");
		expect(await secretOf({ secret: "from-the-config" })).toBe("from-the-config");
	});

	it("14-4 a secret that is set is used byte for byte, the spaces around it too: what it signed and sealed still opens", async () => {
		process.env.MONTI_SECRET = " from the environment ";
		expect(await secretOf({ secret: " secret " })).toBe(" secret ");
		expect(await secretOf({ secret: "  " })).toBe(" from the environment ");
	});

	it("14-4 blank in both is no secret at all", async () => {
		process.env.MONTI_SECRET = "  ";
		expect(await secretOf({ secret: " " })).toBeNull();
		delete process.env.MONTI_SECRET;
		expect(await secretOf({})).toBeNull();
	});
});
