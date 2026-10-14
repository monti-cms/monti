/** Where a person sets an environment value, for the messages that tell them to (`what / where / fix`). */
export declare const WHERE_TO_SET_ENV = ".env.local (and the environment settings of your host)";
/** The environment a value is read from: `process.env`, or the one a command or a test passes. */
export type EnvSource = Readonly<Record<string, string | undefined>>;
/** What `NODE_ENV` is, for a message: `NODE_ENV is "production"`, or `NODE_ENV is not set` (not `NODE_ENV is ""`). */
export declare const describeNodeEnv: (env: EnvSource) => string;
/** The value of an environment variable with its surrounding space removed; `undefined` when it is unset or blank. */
export declare const envValue: (env: EnvSource, name: string) => string | undefined;
