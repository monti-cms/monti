import type { Site } from "@monti-cms/core/site";
import { type ReactNode } from "react";
/**
 * What a plugin's admin side reacts to: `defineAdminPlugin({ on: { <target>: { <event>: [subscribers] } } })`, the same shape as the server's `on`.
 * Admin events are past tense: notifications after the fact that never block what happened. Each event takes a list of independent subscribers, run
 * in the order of the plugins; a failing one never affects the others or the action.
 */
/** The image `editor.imageInserted` reports, as it was inserted. */
export interface InsertedImage {
    /** The media library item, for an image stored in the library. */
    readonly mediaId?: string;
    /** The address, for an image that is not a library item. */
    readonly src?: string;
    readonly alt: string;
    readonly caption: string;
    readonly decorative: boolean;
}
/** The values `fill` may write into the inserted image. */
export interface ImageText {
    readonly alt?: string;
    readonly caption?: string;
}
/**
 * `editor.imageInserted`: an image went into the body (from the image dialog, which drop and paste open too). The image is already in: while any
 * subscriber runs, it shows that its text is being generated.
 */
export interface ImageInsertedEvent {
    readonly image: InsertedImage;
    /** Body text before and after the image, the image's place marked by a line of its own. */
    readonly around: string;
    readonly site: Site;
    /** Aborted when the image is removed from the body (or the editor goes away). */
    readonly signal: AbortSignal;
    /**
     * Writes `alt` and `caption` into the image, each only while that field is still empty and the person has not typed in it since the insert (a
     * decorative image takes no alt). A value that can no longer be written is dropped, never written over what is there. Returns whether anything was
     * written; after the image was removed it writes nothing.
     */
    fill(values: ImageText): boolean;
}
export type ImageInserted = (event: ImageInsertedEvent) => void | Promise<void>;
/** The admin events: targets, then events, then lists of subscribers. */
export interface AdminEvents {
    readonly editor?: {
        readonly imageInserted?: readonly ImageInserted[];
    };
}
/** Adds a plugin's `on` to the events of the admin below it. */
export declare function AdminEventsProvider({ on, children }: {
    readonly on: AdminEvents;
    readonly children: ReactNode;
}): import("react").JSX.Element;
/** The subscribers of the admin events, every plugin's joined. */
export declare const useAdminEvents: () => AdminEvents;
