import config from "@cms-config";
import { unwrapDefault } from "./interop";

/**
 * 호스트 앱의 사이트 설정(`cms.config.ts`)을 읽는 유일한 자리. 앱은 `@cms-config` 별칭을 자기 설정 파일로 잇는다
 * (`withCms`·tsconfig `paths`·테스트 설정). CMS 코드는 설정 파일을 직접 import하지 않고 여기를 거친다.
 *
 * 저작 API(`@monti-cms/core` 진입점)는 이 파일을 import하지 않는다. 설정 파일이 저작 API를 import하므로 순환이 생긴다.
 */
export type ResolvedConfig = typeof config;

/**
 * 타입을 `ResolvedConfig`로 적어 둔다. 적지 않으면 배포 타입 선언(`dist/*.d.ts`)에 빌드 때 쓴 빈 설정의 타입이 굳어
 * 앱의 컬렉션 이름이 `string`으로 뭉개진다.
 */
export const cmsConfig: ResolvedConfig = unwrapDefault(config);
