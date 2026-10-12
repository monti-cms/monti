import { runStoreContractSuite } from "../../../core/store/__test__/contract/store-contract";
import { postgresStoreFactory } from "./store-contract-factory";

/** The Postgres adapter against the `media` suite of the store contract. */
runStoreContractSuite("media", postgresStoreFactory);
