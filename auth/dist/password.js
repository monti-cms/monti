import Credentials from "@auth/core/providers/credentials";
import { passwordLabel } from "./messages.js";
import { hashPassword, verifyPassword } from "./password-hash.js";
/** The fewest characters of a password. */
export const MIN_PASSWORD_LENGTH = 10;
/** Failed sign-ins of one email that are tolerated inside {@link FAILURE_WINDOW_MS}; after that the email is refused until the window passes. */
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 60_000;
const PLUGIN = "auth";
const ACCOUNTS = "password-accounts";
/** Written once, by the first admin. It is what makes "the first admin" atomic: the second writer gets a conflict, whatever email it uses. */
const SETUP = "password-setup";
const FIRST_ADMIN_KEY = "first-admin";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The canonical email: trimmed and lower case. `null` when it is not an email. The email is the account id (`password:mina@example.com`). */
export const normalizeEmail = (value) => {
    const email = value.trim().toLowerCase();
    return email.length <= 254 && EMAIL.test(email) ? email : null;
};
/** A hash to compare against when no account has the email, so an unknown email takes as long to refuse as a wrong password. */
let decoy;
/** The accounts of the built-in login, kept in the plugin storage of the instance. */
export function passwordAccounts(storage) {
    const store = () => storage(PLUGIN);
    const accounts = () => store().collection(ACCOUNTS);
    const failures = new Map();
    const blocked = (email) => {
        const entry = failures.get(email);
        if (!entry)
            return false;
        if (Date.now() - entry.since > FAILURE_WINDOW_MS) {
            failures.delete(email);
            return false;
        }
        return entry.count >= MAX_FAILURES;
    };
    const failed = (email) => {
        const entry = failures.get(email);
        if (!entry || Date.now() - entry.since > FAILURE_WINDOW_MS)
            failures.set(email, { count: 1, since: Date.now() });
        else
            entry.count += 1;
    };
    const invalid = (email, password) => normalizeEmail(email) === null ? "email" : password.length < MIN_PASSWORD_LENGTH ? "password" : null;
    return {
        minPasswordLength: MIN_PASSWORD_LENGTH,
        hasAny: async () => (await accounts().list()).length > 0,
        createFirst: async ({ email, password }) => {
            const refusal = invalid(email, password);
            if (refusal)
                return { ok: false, reason: refusal };
            const key = normalizeEmail(email);
            if ((await accounts().list()).length > 0)
                return { ok: false, reason: "closed" };
            const setup = store().collection(SETUP);
            try {
                await setup.set(FIRST_ADMIN_KEY, { email: key }, { expectedVersion: 0 });
            }
            catch {
                // Another request got there first.
                return { ok: false, reason: "closed" };
            }
            try {
                await accounts().set(key, { email: key, hash: await hashPassword(password) }, { expectedVersion: 0 });
            }
            catch (error) {
                // Nothing was created, so the first admin stays open.
                const written = await setup.get(FIRST_ADMIN_KEY);
                if (written)
                    await setup.delete(FIRST_ADMIN_KEY, { expectedVersion: written.version }).catch(() => undefined);
                throw error;
            }
            return { ok: true };
        },
        resetPassword: async ({ email, password }) => {
            const refusal = invalid(email, password);
            if (refusal)
                return { ok: false, reason: refusal };
            const key = normalizeEmail(email);
            const existing = await accounts().get(key);
            if (!existing)
                return { ok: false, reason: "unknown" };
            await accounts().set(key, { email: key, hash: await hashPassword(password) }, { expectedVersion: existing.version });
            failures.delete(key);
            return { ok: true };
        },
        authorize: async (rawEmail, password) => {
            const email = normalizeEmail(rawEmail);
            if (email === null || blocked(email))
                return null;
            const account = await accounts().get(email);
            decoy ??= hashPassword("decoy");
            const matches = await verifyPassword(password, account?.value.hash ?? (await decoy));
            if (account && matches) {
                failures.delete(email);
                return email;
            }
            failed(email);
            return null;
        },
    };
}
/**
 * Log in with an email and a password. The accounts are kept in Monti's database (the plugin storage of the instance, so `monti migrate` is all the setup there is),
 * with the password hashed by scrypt and a salt per account. Every account is an admin. The first admin is created on the admin's own login screen while no account exists
 * (that screen is closed for good afterwards); `monti admin:reset-password` sets a new password. A few failed sign-ins for one email are followed by a minute of refusals.
 *
 * ```ts
 * auth: auth({ providers: [password()] })
 * ```
 */
export function password() {
    // One set of accounts per login connection, so the failed-attempt counters are shared by the sign-in and the account changes.
    const connections = new WeakMap();
    const accountsOf = (context) => {
        let accounts = connections.get(context);
        if (!accounts) {
            accounts = passwordAccounts(context.storage);
            connections.set(context, accounts);
        }
        return accounts;
    };
    return {
        id: "password",
        name: "Email and password",
        label: passwordLabel,
        everyAccountIsAdmin: true,
        provenance: () => "accounts in the database; the first admin is created on the login screen",
        accounts: accountsOf,
        setup: (context) => {
            const accounts = accountsOf(context);
            return Credentials({
                id: "password",
                name: "Email and password",
                credentials: { email: {}, password: {} },
                authorize: async (credentials) => {
                    const id = await accounts.authorize(String(credentials?.email ?? ""), String(credentials?.password ?? ""));
                    return id ? { id, name: id, email: id } : null;
                },
            });
        },
        account: ({ account }) => ({ id: account.providerAccountId, name: account.providerAccountId }),
        normalizeId: normalizeEmail,
    };
}
