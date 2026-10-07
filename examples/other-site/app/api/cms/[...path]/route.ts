import { createRouteHandler } from "@monti-cms/nextjs";
import { cms } from "../../../../cms.server";

/** Admin API (/api/cms/v1/*) and login (/api/cms/auth/*). */
export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);
