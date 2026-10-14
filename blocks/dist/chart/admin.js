import { defineBlockAdmin } from "../shared/define-block-admin.js";
import { ChartProvider } from "./provider.js";
/** Admin UI side of the chart block plugin. Adds the menu icon. */
export default defineBlockAdmin(ChartProvider);
