import { problemError, SetupError } from "../../core/problem.js";
/** The environment variable `postgres()` reads the connection string from. Kept here so the messages and the adapter name the same one. */
const URL_ENV = "DATABASE_URL";
const SCHEMA_ENV = "DATABASE_SCHEMA";
/** Where the database settings live, for the `where` of a message. */
export const DATABASE_URL_WHERE = `${URL_ENV} in .env.local (or in the environment of the host), or \`postgres({ connectionString })\` in monti.config.ts`;
/** `host:port/database` of a connection string, with no user or password. `undefined` when it cannot be read. */
export function describeConnection(connectionString) {
    if (!connectionString)
        return undefined;
    try {
        const url = new URL(connectionString);
        const database = url.pathname.replace(/^\//, "");
        return `${url.hostname || "localhost"}${url.port ? `:${url.port}` : ""}${database ? `/${database}` : ""}`;
    }
    catch {
        return undefined;
    }
}
const codeOf = (error) => {
    const code = error?.code;
    return typeof code === "string" ? code : undefined;
};
const messageOf = (error) => {
    const message = error?.message;
    return typeof message === "string" ? message : String(error);
};
/**
 * What a Postgres driver error means for someone setting the site up, or `undefined` when it is not a setup problem (a constraint violation, a bug). It covers
 * the first errors a newcomer meets: no database listening, a wrong address, password or database name, a database that is not migrated, an SSL mismatch.
 * `connectionString` and `schema` are the ones in use, to name them in the message (the password is never printed).
 */
export function explainDatabaseError(error, context = {}) {
    if (error instanceof SetupError)
        return error;
    const code = codeOf(error) ?? codeOf(error?.errors?.[0]);
    const message = messageOf(error);
    const target = describeConnection(context.connectionString);
    const at = target ? ` at ${target}` : "";
    const schema = context.schema || "public";
    const problem = (() => {
        if (code === "ECONNREFUSED") {
            return {
                code: "database_unreachable",
                problem: {
                    what: `Nothing is listening for the database${at}`,
                    where: DATABASE_URL_WHERE,
                    fix: "start Postgres, or correct the host and port in DATABASE_URL",
                },
            };
        }
        if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
            return {
                code: "database_unreachable",
                problem: {
                    what: `The database host${at || ""} cannot be found`,
                    where: DATABASE_URL_WHERE,
                    fix: "check the host name in DATABASE_URL for a typo, and that this machine is online",
                },
            };
        }
        if (code === "ETIMEDOUT" || /connection timeout|timeout expired/i.test(message)) {
            return {
                code: "database_unreachable",
                problem: {
                    what: `Connecting to the database${at} timed out`,
                    where: DATABASE_URL_WHERE,
                    fix: "check the host and port in DATABASE_URL, and that a firewall or the provider's IP allow-list lets this machine in",
                },
            };
        }
        if (code === "28P01" || code === "28000") {
            return {
                code: "database_login_failed",
                problem: {
                    what: `The database${at} refused the user or password`,
                    where: DATABASE_URL_WHERE,
                    fix: "correct the user and password in DATABASE_URL (a password with special characters such as @ or / must be percent-encoded)",
                },
            };
        }
        if (code === "3D000") {
            return {
                code: "database_missing",
                problem: {
                    what: `The database${at} does not exist on the server`,
                    where: DATABASE_URL_WHERE,
                    fix: "create it (`createdb <name>`), or correct the database name at the end of DATABASE_URL",
                },
            };
        }
        if (/does not support SSL/i.test(message)) {
            return {
                code: "database_ssl",
                problem: {
                    what: `The database${at} does not use SSL, but the connection asks for it`,
                    where: DATABASE_URL_WHERE,
                    fix: "remove `sslmode=require` from DATABASE_URL (a local Postgres usually has no SSL)",
                },
            };
        }
        if (/self[- ]signed|unable to (get|verify)|certificate (has expired|verify)/i.test(message)) {
            return {
                code: "database_ssl",
                problem: {
                    what: `The database${at} presented a certificate that is not trusted`,
                    where: DATABASE_URL_WHERE,
                    fix: "use the provider's connection string as it is, or add `sslmode=no-verify` to DATABASE_URL if you trust the network",
                },
            };
        }
        if (code === "3F000" || code === "42P01" || code === "42P07") {
            return {
                code: "migrations_pending",
                problem: {
                    what: `The Monti tables are missing in the database schema "${schema}"`,
                    where: `${SCHEMA_ENV} (default public) of ${target ?? "the database"}`,
                    fix: `run \`monti migrate\` against this database (on a deployed site, run it as a step of the deploy), then \`monti doctor\` to check the rest. Driver message: ${message}`,
                },
            };
        }
        if (code === "42703") {
            return {
                code: "migrations_pending",
                problem: {
                    what: "The database tables are older than this version of Monti (a column is missing)",
                    where: `schema "${schema}" of ${target ?? "the database"}`,
                    fix: `run \`monti migrate\` to bring the tables up to date, then restart the server. Driver message: ${message}`,
                },
            };
        }
        if (/Invalid URL|invalid connection string/i.test(message) || code === "ERR_INVALID_URL") {
            return {
                code: "database_url_invalid",
                problem: {
                    what: "The database connection string cannot be read",
                    where: DATABASE_URL_WHERE,
                    fix: "write it as postgres://user:password@host:5432/database (a password with special characters must be percent-encoded)",
                },
            };
        }
        return undefined;
    })();
    return problem ? problemError(problem.problem, error, problem.code) : undefined;
}
