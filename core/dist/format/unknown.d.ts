import { ServiceError } from "../core/types.js";
import type { FormatRegistry } from "./registry.js";
/**
 * The error for a `format` option that names a format no plugin provides (the code stays `unknown_format`; the message says which plugin to add and which
 * formats this site has).
 */
export declare function unknownFormatError(name: string, registry: Pick<FormatRegistry, "list">): ServiceError;
