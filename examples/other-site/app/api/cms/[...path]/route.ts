import { createCmsRouteHandler } from "@monti-cms/core/next/route-handler";

/** Admin API (/api/cms/v1/*) and login (/api/cms/auth/*). */
export const { GET, POST, PATCH, PUT, DELETE } = createCmsRouteHandler();
