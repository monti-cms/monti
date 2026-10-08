/**
 * What a config remembers about the schema file it was made from, so a running instance can be rebuilt with another schema (`cms.forSchema`, `cms.reloadSchema`)
 * without the code part of the config being written again. `defineSite({ schema, ... })` attaches it as a hidden (non-enumerable, symbol) property of the
 * config it returns; a spread of the config does not carry it.
 */
export const SCHEMA_SOURCE = Symbol.for("monti.config.schema-source");
/** The schema source of a config made by `defineSite({ schema })`, or `undefined` (a config written in code only). */
export const schemaSourceOf = (config) => config[SCHEMA_SOURCE];
