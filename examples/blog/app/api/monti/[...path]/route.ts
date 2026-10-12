import { createRouteHandler } from "@monti-cms/nextjs";
import { cms } from "@/monti.config";

/** Admin API (/api/monti/v1/*) and login (/api/monti/auth/*). */
export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);
