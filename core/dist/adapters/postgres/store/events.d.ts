import type { PoolClient } from "pg";
import { type ContentChangeKind } from "../../../core/store/events.js";
import type { EventStore } from "../../../core/store/ports.js";
import type { Entry } from "../../../core/store/types.js";
import type { StoreContext } from "./context.js";
/**
 * Writes the events of a change in the transaction that makes it, so a change that rolls back leaves no event and a change that commits always has one.
 * `entry` is the entry as the change leaves it (for a deletion, as it was).
 */
export declare function recordEvents(client: PoolClient, qSchema: string, entry: Entry, kinds: readonly ContentChangeKind[]): Promise<void>;
/** The outbox reads and writes of the delivery side (`EventStore`). The events themselves are written by `recordEvents` inside each change's transaction. */
export declare function createEventOps(ctx: StoreContext): EventStore;
