import type { AiRunDeps } from "../run.js";
import type { AiRuntime } from "../settings.js";
/**
 * Store connection to pass to the runner. Tags, categories, images and the content lookup of code checks are read directly by the server.
 * `origin` is this site's address. Images outside the media library (site files) are read from here.
 */
export declare function aiRunDeps(runtime: AiRuntime, signal?: AbortSignal, origin?: string): AiRunDeps;
