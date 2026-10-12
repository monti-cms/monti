import { afterAll, describe } from "vitest";
import { entriesContract } from "./entries.contract";
import { eventsContract } from "./events.contract";
import { foldersContract } from "./folders.contract";
import type { ContractSuite, StoreFactory } from "./harness";
import { lifecycleContract } from "./lifecycle.contract";
import { listContract } from "./list.contract";
import { mediaContract } from "./media.contract";
import { preferencesTransferContract } from "./preferences-transfer.contract";
import { publicReadContract } from "./public-read.contract";
import { referencesContract } from "./references.contract";
import { templatesContract } from "./templates.contract";
import { translationsContract } from "./translations.contract";

/**
 * The suites of the contract, one per sub-port of `ContentStore` (see `core/store/ports.ts`), by the name of their `*.contract.ts` file.
 * An adapter runs each suite from its own test file, so the suites run in parallel (`adapters/postgres/__test__/store-contract.*.test.ts`).
 */
export const STORE_CONTRACT_SUITES = {
	entries: entriesContract,
	lifecycle: lifecycleContract,
	translations: translationsContract,
	references: referencesContract,
	list: listContract,
	folders: foldersContract,
	"public-read": publicReadContract,
	media: mediaContract,
	templates: templatesContract,
	"preferences-transfer": preferencesTransferContract,
	events: eventsContract,
} as const satisfies Record<string, ContractSuite>;

export type StoreContractSuiteName = keyof typeof STORE_CONTRACT_SUITES;

/** Runs one suite of the store contract against an adapter. */
export function runStoreContractSuite(suite: StoreContractSuiteName, factory: StoreFactory): void {
	describe(`${factory.name} store contract`, () => {
		STORE_CONTRACT_SUITES[suite](factory);
		afterAll(async () => {
			await factory.dispose?.();
		});
	});
}
