import config from "@cms-server";
import { unwrapDefault } from "../config/interop";

/**
 * 호스트 앱의 서버 설정(`cms.server.ts`)을 읽는 유일한 자리. 앱은 `@cms-server` 별칭을 자기 서버 설정 파일로 잇는다.
 * 연결 객체는 `container.ts`가 처음 쓸 때 만든다.
 *
 * 연결 만들기 API(`@monti-cms/core/server`)는 이 파일을 import하지 않는다. 서버 설정 파일이 그 API를 import하므로
 * 순환이 생긴다.
 */
export const cmsServerConfig = unwrapDefault(config);
