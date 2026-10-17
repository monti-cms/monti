import { defineServerPlugin } from "@monti-cms/core/server";
import { lowercaseSlugs, slugRule } from "./hooks";

export default defineServerPlugin({ hooks: { ...lowercaseSlugs, ...slugRule } });
