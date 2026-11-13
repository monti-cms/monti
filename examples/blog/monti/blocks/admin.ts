"use client";

// The blocks as the admin page gets them: from a "use client" module, so their components reach the admin in the browser (doc 16).
import type { AdminBlockDefinition } from "@monti-cms/admin";
import { blocks } from "./index";

export const adminBlocks = blocks as AdminBlockDefinition[];
