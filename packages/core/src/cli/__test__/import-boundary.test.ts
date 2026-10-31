import { describe, expect, it } from "vitest";
import { importsOf } from "../import-boundary";

describe("import boundary: the config file stays out of client bundles", () => {
	it("reads the imports a file makes at run time", () => {
		expect(
			importsOf(
				[
					'import a from "a";',
					'import type { T } from "types-only";',
					'import { type U, type V } from "also-types";',
					'import { type W, x } from "mixed";',
					'import "side-effect";',
					'export * from "re-export";',
					'export type { Y } from "type-export";',
					'const lazy = () => import("lazy");',
				].join("\n"),
			),
		).toEqual(["a", "mixed", "side-effect", "re-export", "lazy"]);
	});
});
