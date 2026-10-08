import { type LoginProvider } from "./provider.js";
/** An admin entry that is not an account id of its provider, so it is left out. */
export interface IgnoredAdmin {
    readonly provider: LoginProvider;
    readonly entry: string;
}
/** What the admin lists of `auth()` and its providers say: the ids per provider (canonical), and the entries that were left out. */
export interface AdminSets {
    readonly sets: Map<string, Set<string>>;
    readonly ignored: IgnoredAdmin[];
}
interface AdminOptions {
    readonly providers: readonly LoginProvider[];
    readonly admins?: readonly (string | undefined)[];
}
/**
 * The admin ids of every provider, as canonical ids inside each provider: the ones listed on a provider (`github({ admins })`, `MONTI_ADMIN_GITHUB_ID`) and the
 * qualified ones of `auth({ admins })`. Throws when an entry is listed under the wrong provider or is not qualified.
 */
export declare function collectAdmins(options: AdminOptions): AdminSets;
/** The message for an admin entry that was left out. */
export declare const ignoredAdminText: ({ provider, entry }: IgnoredAdmin) => string;
export {};
