import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { ChartProvider } from "./provider";

/** Admin UI side of the chart block plugin. Adds the menu icon. */
export default defineAdminPlugin({ Provider: ChartProvider });
