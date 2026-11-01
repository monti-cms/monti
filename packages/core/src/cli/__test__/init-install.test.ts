import { describe, expect, it } from "vitest";
import { installSpecs } from "../init-install";

const GITHUB = "github:monti-cms/monti#release/v0.2.0-next.16&path:/core";

describe("installSpecs", () => {
	it("INIT-I1 gives each Monti package the core address with its own folder, and leaves other packages bare", () => {
		expect(installSpecs(["@monti-cms/admin", "@monti-cms/syntax-shiki", "next-themes"], GITHUB)).toEqual([
			"@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.16&path:/admin",
			"@monti-cms/syntax-shiki@github:monti-cms/monti#release/v0.2.0-next.16&path:/syntax-shiki",
			"next-themes",
		]);
	});

	it("INIT-I1 takes path:/core in any place of the address", () => {
		expect(installSpecs(["@monti-cms/auth"], "github:monti-cms/monti&path:/core")).toEqual([
			"@monti-cms/auth@github:monti-cms/monti&path:/auth",
		]);
	});

	it("INIT-I1 keeps bare names for a version range, a missing spec or an address without path:/core", () => {
		const names = ["@monti-cms/admin", "next-themes"];
		for (const spec of ["^0.2.0", "0.2.0-next.0", "latest", "workspace:*", "github:monti-cms/monti#main", undefined]) {
			expect(installSpecs(names, spec)).toEqual(names);
		}
	});
});
