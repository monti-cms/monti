import type { LoginAccounts } from "@monti-cms/core/adapters";
import type { PluginStorage } from "@monti-cms/core/server";
import type { LoginProvider } from "./provider.js";
/** The fewest characters of a password. */
export declare const MIN_PASSWORD_LENGTH = 10;
/** The canonical email: trimmed and lower case. `null` when it is not an email. The email is the account id (`password:mina@example.com`). */
export declare const normalizeEmail: (value: string) => string | null;
/** What `password()` takes. */
export interface PasswordOptions {
    /**
     * The request header in which a trusted reverse proxy puts the address of the client (`"x-forwarded-for"`, `"x-real-ip"`, `"cf-connecting-ip"`, `"x-vercel-forwarded-for"`).
     * With it, failed sign-ins are also counted per client address. Leave it out when no proxy you trust sets the header, because a client can send it itself and would
     * pick its own address. For a comma separated list (`x-forwarded-for`), the last address is used: it is the one the nearest proxy added.
     */
    readonly clientIpHeader?: string;
}
/** The accounts of the built-in login, kept in the plugin storage of the instance. */
export declare function passwordAccounts(storage: (plugin: string) => PluginStorage, now?: () => number): LoginAccounts & {
    authorize(email: string, password: string, clientIp?: string | null): Promise<string | null>;
};
/**
 * Log in with an email and a password. The accounts are kept in Monti's database (the plugin storage of the instance, so `monti db:migrate` is all the setup there is),
 * with the password hashed by scrypt and a salt per account. Every account is an admin. The first admin is created on the admin's own login screen while no account exists
 * (that screen is closed for good afterwards); `monti admin:reset-password` sets a new password. A few failed sign-ins for one email (and, with `clientIpHeader`, for one client address) are followed by a minute of refusals; the counters are kept in the database, so every server instance shares them.
 *
 * ```ts
 * auth: auth({ providers: [password()] })
 * ```
 */
export declare function password(options?: PasswordOptions): LoginProvider;
