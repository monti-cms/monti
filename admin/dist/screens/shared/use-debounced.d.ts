/** The value follows only after it has not changed for `delay` ms. The first value is used immediately. Avoids sending many requests while typing. */
export declare function useDebounced<T>(value: T, delay: number): T;
/**
 * Text typed into a field whose value lives elsewhere (the address, a query): the field keeps its own text so typing is never delayed, and
 * `commit` is called with it once typing pauses. The text follows `committed` when that changes from outside (a cleared filter).
 */
export declare function useDebouncedInput(committed: string, commit: (text: string) => void, delay?: number): readonly [text: string, setText: (text: string) => void];
/**
 * A function that runs `delay` ms after its last call, with the arguments of that call (saving column widths after a drag stops). The latest `callback` is used,
 * and a call still waiting when the component unmounts is dropped.
 */
export declare function useDebouncedCallback<Args extends unknown[]>(callback: (...args: Args) => void, delay: number): (...args: Args) => void;
