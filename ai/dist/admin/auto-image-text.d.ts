import type { AdminEvents, ImageInsertedEvent } from "@monti-cms/admin";
import type { Site } from "@monti-cms/core/site";
/**
 * `editor.imageInserted` of the AI plugin: runs `imageAlt` and `imageCaption` on the inserted image and fills each
 * empty field with the first candidate. An action that is off or whose connection is not ready is skipped; a failure is the editor's notice.
 */
export declare function autoImageText(event: ImageInsertedEvent): Promise<void>;
/**
 * The AI plugin's admin events: `autoImageText` only with `ai({ autoImageText: true })`, so without it the image dialog still asks for alt text. A
 * function of a `"use client"` module, so the browser receives it.
 */
export declare const aiAdminEvents: (site: Site) => AdminEvents;
