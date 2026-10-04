/**
 * Next 밖(직접 만든 명령줄 스크립트)에서 CMS 코드가 읽는 `@cms-config`·`@cms-server`를 앱의 설정 파일로 잇는다.
 * 표 만들기는 명령줄 `monti migrate`가 스스로 잇는다.
 *
 * ```sh
 * tsx --env-file=.env.local --import @monti-cms/core/register my-script.ts
 * ```
 *
 * 설정 파일 경로는 `CMS_CONFIG_PATH`·`CMS_SERVER_PATH`(기본 `./cms.config.ts`·`./cms.server.ts`, 현재 폴더 기준)다.
 */
import { register } from "node:module";

register(new URL(import.meta.url.endsWith(".ts") ? "./register-hooks.ts" : "./register-hooks.js", import.meta.url));
