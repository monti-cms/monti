import { runStoreContractSuite } from "../../../core/store/__test__/contract/store-contract";
import { postgresStoreFactory } from "./store-contract-factory";

/** The Postgres adapter against the `list` suite of the store contract. */
runStoreContractSuite("list", postgresStoreFactory);
