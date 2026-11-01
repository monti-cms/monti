/// <reference types="vite/types/importMeta.d.ts" />
import { afterAll, describe } from "vitest";
import type { ContractSuite, StoreFactory } from "./harness";

/**
 * The suites of the contract, one per sub-port of `ContentStore` (see `core/store/ports.ts`), each in its own `*.contract.ts` file. The list is
 * every `*.contract.ts` file of this folder (Vite's `import.meta.glob`), so a suite written here runs against every adapter without being listed.
 */
const SUITES: readonly ContractSuite[] = Object.entries(
	import.meta.glob<Record<string, unknown>>("./*.contract.ts", { eager: true }),
).map(([file, module]) => {
	const suites = Object.values(module).filter((value): value is ContractSuite => typeof value === "function");
	if (suites.length !== 1) throw new Error(`${file} must export exactly one contract suite (found ${suites.length})`);
	return suites[0] as ContractSuite;
});

/** Runs every suite of the store contract against an adapter. An adapter calls it from one test file. */
export function runStoreContract(factory: StoreFactory): void {
	describe(`${factory.name} store contract`, () => {
		for (const suite of SUITES) suite(factory);
		afterAll(async () => {
			await factory.dispose?.();
		});
	});
}
