import type { AuthContext } from "../adapters/auth/index.js";
/** Runs `run` with `actor` as the one making the changes (none for `null` and `undefined`). */
export declare const withActor: <T>(actor: string | null | undefined, run: () => T) => T;
/** The one making the change that is being carried out, or `null` outside a request or when it is not known. */
export declare const currentActor: () => string | null;
/** The name an admin is recorded under: the name the login method gives (the GitHub name or login), else the account ID. */
export declare const actorOf: (auth: Pick<AuthContext, "name" | "accountId">) => string;
