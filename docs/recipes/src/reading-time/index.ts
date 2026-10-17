import { definePlugin } from "@monti-cms/core";

export const readingTime = () => definePlugin({ name: "reading-time", admin: () => import("./admin") });
