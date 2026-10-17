import { definePlugin } from "@monti-cms/core";

export const markdown = () => definePlugin({ name: "markdown", server: () => import("./server") });
