/**
 * Something Monti decided on its own, and why. "Automatic is fine, silent is not": `monti doctor` lists these, so nobody has to
 * guess where a value came from.
 *
 * `source` is one of: `set in monti.config.ts (...)`, `from env NAME`, or `auto-detected (reason)`.
 */
export interface Decision {
    /** What was decided: `Database`, `Login`, `Trust host`, ... */
    readonly topic: string;
    /** The outcome, short: `localhost:5432/monti`, `on`, `off`. */
    readonly value: string;
    /** Where the value comes from, or the reason it was picked. */
    readonly source: string;
}
/** `Database: localhost:5432/monti [from env DATABASE_URL]` */
export declare const formatDecision: (decision: Decision) => string;
