import config from "@cms-config";
import { unwrapDefault } from "./interop.js";
/**
 * Spell the type out as `ResolvedConfig`. Otherwise the published type declarations (`dist/*.d.ts`) freeze the type of the empty config used at build time
 * and the app's collection names collapse to `string`.
 */
export const cmsConfig = unwrapDefault(config);
