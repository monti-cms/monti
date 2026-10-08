import type { PluginStorage } from "@monti-cms/core";
import type { LoginAccounts } from "@monti-cms/core/server";
import type { LoginProvider } from "./provider.js";
/** The fewest characters of a password. */
export declare const MIN_PASSWORD_LENGTH = 10;
/** The canonical email: trimmed and lower case. `null` when it is not an email. The email is the account id (`password:mina@example.com`). */
export declare const normalizeEmail: (value: string) => string | null;
/** The accounts of the built-in login, kept in the plugin storage of the instance. */
export declare function passwordAccounts(storage: (plugin: string) => PluginStorage): LoginAccounts & {
    authorize(email: string, password: string): Promise<string | null>;
};
/**
 * Log in with an email and a password. The accounts are kept in Monti's database (the plugin storage of the instance, so `monti migrate` is all the setup there is),
 * with the password hashed by scrypt and a salt per account. Every account is an admin. The first admin is created on the admin's own login screen while no account exists
 * (that screen is closed for good afterwards); `monti admin:reset-password` sets a new password. A few failed sign-ins for one email are followed by a minute of refusals.
 *
 * ```ts
 * auth: auth({ providers: [password()] })
 * ```
 */
export declare function password(): LoginProvider;
