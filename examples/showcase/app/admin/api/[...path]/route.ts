import { adminRoute } from "@monti-cms/next";
import { monti } from "@/lib/monti";

// The admin's API, the files it serves, and the preview's on and off.
export const { GET, POST, PUT } = adminRoute(monti);
