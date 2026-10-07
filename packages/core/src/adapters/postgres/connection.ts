/**
 * The connection string as the driver should read it.
 *
 * `pg` (through `pg-connection-string`) treats `sslmode=prefer`, `require` and `verify-ca` as aliases of `verify-full`: encrypted, with the certificate and the host
 * name checked. It prints a 9-line SECURITY WARNING for them on every process, because a later major version switches to the libpq meaning (encrypted, but no
 * certificate check). Providers such as Neon and Supabase hand out `sslmode=require` URLs, so every command printed the warning.
 *
 * We spell out what `pg` does today, `sslmode=verify-full`. That keeps the connection exactly as secure as it is now (the certificate is verified), it does not
 * change with a driver upgrade, and the warning has nothing left to warn about. We do not add `uselibpqcompat=true`: with `require` that would stop verifying the
 * certificate, a weaker connection than the one people get today. A URL that sets `uselibpqcompat` itself, or a mode this does not touch (`disable`, `no-verify`,
 * `verify-full`), is left as it is, so a person who chose a mode gets exactly that one.
 */
export function normalizeConnectionString(connectionString: string): string {
	if (/[?&]uselibpqcompat=/i.test(connectionString)) return connectionString;
	return connectionString.replace(/([?&]sslmode=)(?:prefer|require|verify-ca)(?=&|#|$)/i, "$1verify-full");
}
