/**
 * The pg driver (through `pg-connection-string`) treats `sslmode=prefer`, `require` and `verify-ca` as aliases of `verify-full`: encrypted, with the certificate
 * and the host name checked. It prints a 9-line SECURITY WARNING for them on every process, because a later major version switches to the libpq meaning
 * (encrypted, but no certificate check). Providers such as Neon and Supabase hand out `sslmode=require` URLs.
 *
 * The URL is passed to the driver exactly as written; nothing here rewrites it. `monti doctor` calls this to explain the warning and the way to silence it.
 * Returns the explanation, or `undefined` when the URL has no mode the driver warns about (or already chose `uselibpqcompat`).
 */
export declare function sslmodeWarning(connectionString: string): string | undefined;
/** What to write in the URL to say what the driver already does, so the warning has nothing left to warn about. */
export declare const SSLMODE_FIX = "change sslmode=... to sslmode=verify-full in DATABASE_URL (the connection stays exactly as secure as it is now). Only if you want the libpq meaning (no certificate check for require), add uselibpqcompat=true to the URL instead";
