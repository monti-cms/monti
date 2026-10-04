/** The value follows only after it has not changed for `delay` ms. The first value is used immediately. Avoids sending many requests while typing. */
export declare function useDebounced<T>(value: T, delay: number): T;
