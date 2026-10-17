import { definePlugin } from "@monti-cms/core";

export const slugRulePlugin = () => definePlugin({ name: "slug-rule", server: () => import("./server") });
