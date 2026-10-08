import { definePlugin } from "@monti-cms/core";

/** The field to add to a collection: `fields: { …, readingTime: readingTimeField }`. It stores no value. */
export const readingTimeField = { kind: "view", view: "reading-time", label: "Reading time" } as const;

/** `plugins: [readingTime()]` registers the screen of the field above in the admin. */
export const readingTime = () => definePlugin({ name: "reading-time", options: {}, admin: () => import("./admin") });
