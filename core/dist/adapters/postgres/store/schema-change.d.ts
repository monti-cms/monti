import type { SchemaChangeStore } from "../../../core/store/ports.js";
import { type StoreContext } from "./context.js";
/** The schema-change part of the content store: reads the applied schema, scans bodies, and applies the transforms (`SchemaChangeStore`). */
export declare function createSchemaChangeOps(ctx: StoreContext): SchemaChangeStore;
