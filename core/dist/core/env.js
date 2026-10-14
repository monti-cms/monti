/** Where a person sets an environment value, for the messages that tell them to (`what / where / fix`). */
export const WHERE_TO_SET_ENV = ".env.local (and the environment settings of your host)";
/** What `NODE_ENV` is, for a message: `NODE_ENV is "production"`, or `NODE_ENV is not set` (not `NODE_ENV is ""`). */
export const describeNodeEnv = (env) => env.NODE_ENV ? `NODE_ENV is "${env.NODE_ENV}"` : "NODE_ENV is not set";
/** The value of an environment variable with its surrounding space removed; `undefined` when it is unset or blank. */
export const envValue = (env, name) => env[name]?.trim() || undefined;
