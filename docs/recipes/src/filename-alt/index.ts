import { definePlugin } from "@monti-cms/core";

export const filenameAlt = () => definePlugin({ name: "filename-alt", admin: () => import("./admin") });
