import type { CmsServerPlugin } from "@monti-cms/core";
import { readBareunOptions } from "./config";
import { BAREUN_ROUTE } from "./options";
import { bareunRoute } from "./route";

export { type BareunRequestOptions, checkWithBareun, requestBareun } from "./api";
export { bareunRoute } from "./route";

/** 바른 검사기의 서버 쪽. 본체 API 처리기가 경로표로 불러 쓴다. 브라우저 묶음에는 들어가지 않는다. */
const bareunServer: CmsServerPlugin = {
	routes: [{ pattern: BAREUN_ROUTE, module: bareunRoute(readBareunOptions()) }],
};

export default bareunServer;
