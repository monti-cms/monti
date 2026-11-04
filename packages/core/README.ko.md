# @monti-cms/core

[English](README.md) | 한국어

Monti가 하는 일은 모두 **기능**이다. 기능 하나를 정의하면 관리자 API 라우트, 에이전트 도구, CLI 명령이 같은 입력 검사, 버전 확인, 활동 기록과
함께 생긴다. 그래서 어느 입구도 다른 입구의 규칙을 비켜 가지 못한다. 설계는
[`docs/design/features/00-foundation.md`](../../docs/design/features/00-foundation.md)에 있다.

```ts
import { defineOperation } from "@monti-cms/core";
import { z } from "zod";

export const moveToFolder = defineOperation({
	name: "entries.moveToFolder",
	kind: "write",
	description: "Move entries into a folder.", // for the model
	input: z.object({ ids: z.array(z.string()).min(1), folderId: z.string() }),
	touches: (input) => input.ids.map((id) => ({ kind: "entry", id })), // versioned and snapshotted for undo
	check: async (input, ctx) => {/* throw CheckError to refuse */},
	run: async (input, ctx) => {/* write through ctx.db; ctx.emit(event) for receivers */},
	summary: (input) => ({ key: "entries.moveToFolder", values: { count: input.ids.length } }),
});
```

## 쓰기가 도는 길

`createMonti({ db, operations, recordKinds, receivers, plugins })`는 모든 쓰기를 같은 길로, 한 트랜잭션 안에서 돌린다.

1. 입력을 스키마로 검사한다.
2. `touches`의 레코드를 읽는다. 부른 쪽이 읽은 버전이 지금 버전과 다르면 충돌이다(`ConflictError`).
3. `check`, 그다음 `run`.
4. 활동 기록 한 줄과, 건드리고 만든 레코드의 스냅숏을 남긴다. 그래서 30일 동안 되돌릴 수 있다(`activity.undo`). 되돌리기는 그 사이 고쳐진
   레코드를 건너뛰고 덮어쓰지 않는다.
5. 쓰기가 낸 이벤트는 받는 곳마다 줄에 넣고, 커밋된 뒤에만 보낸다. 실패한 전송은 정해진 사이로 다시 보낸다(`RETRY_MINUTES`).

레코드 종류(`defineRecordKind`)는 엔진에게 레코드의 상태를 읽는 법과 옛 상태로 되돌리는 법을 알려 준다.

## 입구

| 입구 | 누가 | 쓰기 |
|---|---|---|
| `createAdminApi(monti, { authenticate })` | 관리자 화면 | 바로 실행 |
| `agentTools(monti)`, `callAgentTool(...)` | 어시스턴트 | 제안 항목이 된다. `monti.proposals.apply`가 나중에 같은 길로 실행한다 |
| `runCli(monti, argv, io)` | 터미널의 개발자 | 바로 실행 |

`humanOnly`인 기능은 에이전트 도구가 되지 않는다. `screen` 기능은 브라우저가 실행하고 서버는 실행하지 않는다.

## 스키마와 명령줄

사이트에는 파일이 둘 있다. `monti.schema.ts`는 사이트 코드가 기대는 구조 값(컬렉션, 필드, 공개 주소)을 관리자가 다시 쓸 수 있는 순수한 값
하나로 담는다. `monti.config.ts`는 그것을 가져오고 데이터베이스를 적는다.

```ts
import { defineConfig } from "@monti-cms/core";
import schema from "./monti.schema";

export default defineConfig({ schema, database: process.env.DATABASE_URL });
```

표시 이름, 도움말, 배치, 편집기 허용은 데이터베이스의 관리자 값이다(`collections.updateAdminValues`). 운영 사이트에서도 고칠 수 있다.

구조는 개발 서버에서만 바꾼다. `schema.plan`은 초안이 무엇을 바꾸고 저장된 값에 대해 검토에서 무엇을 골라야 하는지 보인다. `schema.apply`는
`monti.schema.ts`와 `monti/changes`의 변경 파일을 쓰고 적용한다. 운영 사이트는 배포할 때 같은 변경 파일을 따르고, 구조를 바꾸는 길은 없다.

```sh
monti db:setup          # 표를 만들고 모든 변경 파일을 따른다
monti db:migrate        # 배포할 때: 이 데이터베이스가 아직 안 따른 변경 파일을 따른다
monti deliveries:run    # 때가 된 웹훅 다시 보내기
monti help              # 모든 기능, 기능마다 명령 하나
monti schema.read
```

## 테스트

```sh
CMS_TEST_DATABASE_URL=postgres://localhost/monti_test pnpm test
```

테스트 파일마다 테스트 데이터베이스에 자기 스키마를 만든다. 테스트 이름은 그 테스트가 지키는 기능 문서의 끝 조건 번호로 시작한다(`00-1 …`).
