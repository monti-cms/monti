// 빌드 전용: 앱의 사이트 설정 자리. 낸 코드는 `@cms-config`를 그대로 import하고, 앱이 자기 설정 파일로 잇는다.
import type { CmsConfig } from "../src/config/define";

declare const config: CmsConfig;
export default config;
