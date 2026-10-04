// 빌드 전용: 앱의 서버 설정 자리(`@cms-server`).
import type { CmsServerConfig } from "../src/server/define";

declare const config: CmsServerConfig;
export default config;
