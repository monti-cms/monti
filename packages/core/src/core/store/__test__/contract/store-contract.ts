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

/** The suites of the contract, one per sub-port of `ContentStore` (see `core/store/ports.ts`). */
const SUITES: readonly ContractSuite[] = [
	entriesContract,
	lifecycleContract,
	translationsContract,
	referencesContract,
	listContract,
	foldersContract,
	publicReadContract,
	mediaContract,
	templatesContract,
	preferencesTransferContract,
	eventsContract,
];

/** Runs the whole store contract against an adapter. */
export function runStoreContract(factory: StoreFactory): void {
	describe(`${factory.name} store contract`, () => {
		for (const suite of SUITES) suite(factory);
		afterAll(async () => {
			await factory.dispose?.();
		});
	});
}
