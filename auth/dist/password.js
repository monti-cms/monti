import Credentials from "@auth/core/providers/credentials";
import { passwordLabel } from "./messages.js";
import { hashPassword, verifyPassword } from "./password-hash.js";
/** The fewest characters of a password. */
export const MIN_PASSWORD_LENGTH = 10;
/** Failed sign-ins of one email that are tolerated inside {@link FAILURE_WINDOW_MS}; after that the email is refused until the window passes. */
const MAX_FAILURES = 5;
/** The same for one client address, when {@link PasswordOptions.clientIpHeader} is set. Higher, because an address can be an office or a school behind one NAT. */
const MAX_FAILURES_PER_IP = 20;
const FAILURE_WINDOW_MS = 60_000;
/** The most counters kept at once. Over it, a counter that does not exist yet is not started (the ones that exist keep counting), so the table cannot grow without bound. */
const MAX_COUNTERS = 10_000;
/** Tries to write a counter again when another request changed it first. */
const WRITE_ATTEMPTS = 4;
const PLUGIN = "auth";
const ACCOUNTS = "password-accounts";
/** Written once, by the first admin. It is what makes "the first admin" atomic: the second writer gets a conflict, whatever email it uses. */
const SETUP = "password-setup";
/** The failed-attempt counters, in the same storage as the accounts, so every server instance sees the same ones. */
const ATTEMPTS = "password-attempts";
const FIRST_ADMIN_KEY = "first-admin";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The canonical email: trimmed and lower case. `null` when it is not an email. The email is the account id (`password:mina@example.com`). */
export const normalizeEmail = (value) => {
    const email = value.trim().toLowerCase();
    return email.length <= 254 && EMAIL.test(email) ? email : null;
};
/** A hash to compare against when no account has the email, so an unknown email takes as long to refuse as a wrong password. */
let decoy;
/** The address of the client in a header value, or `null` when it is empty. */
const clientIpOf = (request, header) => {
    const value = header ? request?.headers.get(header) : null;
    const last = value?.split(",").at(-1)?.trim().toLowerCase();
    return last ? last.slice(0, 64) : null;
};
/** The accounts of the built-in login, kept in the plugin storage of the instance. */
export function passwordAccounts(storage, now = Date.now) {
    const store = () => storage(PLUGIN);
    const accounts = () => store().collection(ACCOUNTS);
    const attempts = () => store().collection(ATTEMPTS);
    /** The counters of a sign-in: the email's, and the client's when its address is known. An email that has no account shares one counter, so guessing emails cannot grow the table. */
    const keysOf = (email, known, clientIp) => [
        { key: `email:${known ? email : "*"}`, max: MAX_FAILURES },
        ...(clientIp ? [{ key: `ip:${clientIp}`, max: MAX_FAILURES_PER_IP }] : []),
    ];
    const live = (counter) => counter !== undefined && now() - counter.since <= FAILURE_WINDOW_MS;
    const blocked = async (keys) => {
        for (const { key, max } of keys) {
            const counter = (await attempts().get(key))?.value;
            if (live(counter) && counter.count >= max)
                return true;
        }
        return false;
    };
    /** Removes the counters whose window is over. Returns how many are left. */
    const prune = async () => {
        const items = await attempts().list();
        const over = items.filter((item) => !live(item.value));
        await Promise.all(over.map((item) => attempts()
            .delete(item.key, { expectedVersion: item.version })
            .catch(() => undefined)));
        return items.length - over.length;
    };
    const count = async (key) => {
        for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
            const stored = await attempts().get(key);
            if (!stored && (await prune()) >= MAX_COUNTERS)
                return;
            const next = live(stored?.value)
                ? { count: stored.value.count + 1, since: stored.value.since }
                : { count: 1, since: now() };
            try {
                await attempts().set(key, next, { expectedVersion: stored?.version ?? 0 });
                return;
            }
            catch {
                // Another request changed the counter first: read it again.
            }
        }
    };
    const failed = async (keys) => {
        for (const { key } of keys)
            await count(key);
    };
    const forgive = async (key) => {
        const stored = await attempts().get(key);
        if (stored)
            await attempts()
                .delete(key, { expectedVersion: stored.version })
                .catch(() => undefined);
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
            await forgive(`email:${key}`);
            return { ok: true };
        },
        authorize: async (rawEmail, password, clientIp = null) => {
            const email = normalizeEmail(rawEmail);
            if (email === null)
                return null;
            const account = await accounts().get(email);
            const keys = keysOf(email, account !== null, clientIp);
            if (await blocked(keys)) {
                // A refused attempt still counts against the client address, so a flood from one address keeps it refused.
                await failed(keys.slice(1));
                return null;
            }
            decoy ??= hashPassword("decoy");
            const matches = await verifyPassword(password, account?.value.hash ?? (await decoy));
            if (account && matches) {
                await forgive(`email:${email}`);
                return email;
            }
            await failed(keys);
            return null;
        },
    };
}
/**
 * Log in with an email and a password. The accounts are kept in Monti's database (the plugin storage of the instance, so `monti db:migrate` is all the setup there is),
 * with the password hashed by scrypt and a salt per account. Every account is an admin. The first admin is created on the admin's own login screen while no account exists
 * (that screen is closed for good afterwards); `monti admin:reset-password` sets a new password. A few failed sign-ins for one email (and, with `clientIpHeader`, for one client address) are followed by a minute of refusals; the counters are kept in the database, so every server instance shares them.
 *
 * ```ts
 * auth: auth({ providers: [password()] })
 * ```
 */
export function password(options = {}) {
    // One set of accounts per login connection, so the sign-in and the account changes use the same counters.
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
        ...(options.clientIpHeader ? { forwardHeaders: [options.clientIpHeader] } : {}),
        provenance: () => "accounts in the database; the first admin is created on the login screen",
        accounts: accountsOf,
        setup: (context) => {
            const accounts = accountsOf(context);
            return Credentials({
                id: "password",
                name: "Email and password",
                credentials: { email: {}, password: {} },
                authorize: async (credentials, request) => {
                    const id = await accounts.authorize(String(credentials?.email ?? ""), String(credentials?.password ?? ""), clientIpOf(request, options.clientIpHeader));
                    return id ? { id, name: id, email: id } : null;
                },
            });
        },
        account: ({ account }) => ({ id: account.providerAccountId, name: account.providerAccountId }),
        normalizeId: normalizeEmail,
    };
}
