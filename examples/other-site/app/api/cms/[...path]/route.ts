import { createCmsRouteHandler } from "@monti-cms/core/next/route-handler";

/** 관리자 API(/api/cms/v1/*)와 로그인(/api/cms/auth/*). */
export const { GET, POST, PATCH, PUT, DELETE } = createCmsRouteHandler();
