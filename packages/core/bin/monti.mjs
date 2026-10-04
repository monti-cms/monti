#!/usr/bin/env node
// 명령줄 `monti`(init·migrate). 앱의 TypeScript 설정 파일(cms.config.ts·cms.server.ts)과, 저장소 안에서는 이 패키지의
// 소스도 읽어야 하므로 tsx를 먼저 건 뒤 명령 코드(`@monti-cms/core/cli`)를 불러온다.
// (`--import tsx`와 같다: ES 모듈과 CommonJS 둘 다. `"type": "module"`이 아닌 앱의 .ts는 CommonJS로 읽힌다.)
import "tsx";

const { runCli } = await import("@monti-cms/core/cli");
process.exitCode = await runCli(process.argv.slice(2));
