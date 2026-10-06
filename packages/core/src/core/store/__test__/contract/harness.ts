import type { AfterCommit } from "../../after-commit";
import type { ContentStore } from "../../ports";

/**
 * What a store adapter gives the contract tests. The contract (`store-contract.ts`) holds the behavior every `ContentStore` has to show, whatever database
 * is behind it; a test file for an adapter calls `runStoreContract(factory)` with its own factory. Behavior that depends on how an adapter stores things
 * (tables, migrations, transactions seen from a second connection) is tested in the adapter's own folder.
 */
export interface StoreFactory {
	/** Adapter name, shown in the test titles. */
	readonly name: string;
	/** Creates a new empty store, ready to use, in its own isolated space (a schema, a database, a directory). */
	create(options?: { readonly afterCommit?: AfterCommit }): Promise<StoreSession>;
	/** Called once after the whole contract ran (closes what the factory shares between sessions). */
	dispose?(): Promise<void>;
}

export interface StoreSession {
	readonly store: ContentStore;
	/** Removes the isolated space and closes its connections. */
	close(): Promise<void>;
}

/** One suite of the contract. It registers its tests with `describe` and creates the stores it needs from the factory. */
export type ContractSuite = (factory: StoreFactory) => void;
