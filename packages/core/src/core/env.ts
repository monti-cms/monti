/** Where a person sets an environment value, for the messages that tell them to (`what / where / fix`). */
export const WHERE_TO_SET_ENV = ".env.local (and the environment settings of your host)";

/** The environment a value is read from: `process.env`, or the one a command or a test passes. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** The value of an environment variable with its surrounding space removed; `undefined` when it is unset or blank. */
export const envValue = (env: EnvSource, name: string): string | undefined => env[name]?.trim() || undefined;
