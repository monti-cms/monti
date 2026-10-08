interface ChangingStore {
    permanentDeleteEntry(params: {
        id: string;
        expectedVersion: number;
    }): Promise<void>;
}
/**
 * Wraps the store's mutation functions so `dispatch` is called with the entry id after each commit. The store has already written the events of the change
 * in its own transaction (the outbox), so `dispatch` only delivers them. If it throws, the committed change stays and the request does not fail (the
 * error is logged), and the undelivered events are found by the next retry.
 */
export declare function withEventDispatch<S extends ChangingStore>(store: S, dispatch: (entryId: string) => Promise<void>): S;
export {};
