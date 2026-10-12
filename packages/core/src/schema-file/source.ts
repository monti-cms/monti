/**
 * What a config remembers about the schema it was made from, so a running instance can be rebuilt with another schema (`cms.forSchema`, `cms.reloadSchema`)
 * without the code part of the config being written again. `defineSite({ schema, ... })` attaches it as a hidden (non-enumerable, symbol) property of the
 * config it returns; a spread of the config does not carry it.
 */
export const SCHEMA_SOURCE: unique symbol = Symbol.for("monti.config.schema-source") as never;

export interface SchemaSource {
	/** The config again, with the code part as it was and `schema` (the data `defineSchema` returned) replaced. Throws what `defineSite` throws. */
	rebuild(schema: unknown): object;
}

/** The schema source of a config made by `defineSite({ schema })`, or `undefined` (a config written in code only). */
export const schemaSourceOf = (config: object): SchemaSource | undefined =>
	(config as { [SCHEMA_SOURCE]?: SchemaSource })[SCHEMA_SOURCE];
