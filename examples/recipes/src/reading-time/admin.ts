import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { ReadingTimeProvider } from "./provider";

export default defineAdminPlugin({ Provider: ReadingTimeProvider });
