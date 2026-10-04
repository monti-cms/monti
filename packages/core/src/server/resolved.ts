import config from "@cms-server";
import { unwrapDefault } from "../config/interop";

/**
 * The only place that reads the host app's server config (`cms.server.ts`). The app points the `@cms-server` alias at its own server config file.
 * The connection objects are created by `container.ts` on first use.
 *
 * The connection-building API (`@monti-cms/core/server`) does not import this file: the server config file imports that API,
 * so it would form a cycle.
 */
export const cmsServerConfig = unwrapDefault(config);
