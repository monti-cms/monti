"use client";

// The blocks as the admin page gets them: from a "use client" module, so their components reach the admin in the browser (doc 16).
import type { AdminBlockDefinition, AdminMarkDefinition } from "@monti-cms/admin";
import { blocks, marks } from "./index";

export const adminBlocks = blocks as AdminBlockDefinition[];
export const adminMarks = marks as AdminMarkDefinition[];
