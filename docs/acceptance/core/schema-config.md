# `resources/schema/` · `resources/config/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.5절(`ReadContext`, `WriteContext`, `MontiConfig`), 4절(컨텍스트와 설정), 7절(`schema`, `config` 리소스), 8절(`state.ts`, `schema-file.ts`, `config-file.ts`)의 인수 조건이다.

- `schema.get`: 현재 스키마(`ctx.schema`)를 돌려준다.
- `schema.update`: 개발 서버(`config.dev: true`)에서만 스키마를 바꾸고 커밋 뒤에 공유 상태와 스키마 파일에 반영한다. 정의된 8종 필드(`text`·`number`·`boolean`·`date`·`select`·`media`·`relation`·`conditional`) 외의 `type`이면 `BAD_REQUEST`, 개발 서버가 아니면 `FORBIDDEN`으로 거절하며, 롤백·`dryRun`이면 공유 상태와 파일을 바꾸지 않는다.
- `config.get`: 현재 사이트 설정(`ctx.config`)을 돌려준다.
- `config.update`: 개발 서버에서만 사이트 `name`을 바꾸고 커밋 뒤에 공유 상태와 설정 파일에 반영한다. 개발 서버가 아니면 `FORBIDDEN`으로 거절하며, 롤백·`dryRun`이면 공유 상태와 파일을 바꾸지 않는다.

---

## 1. 스키마 조회 (`schema.get`)

```
SCH-GET-1  현재 스키마를 돌려준다
  전제  초기 스키마로 엔진이 생성되어 있다
  행동  `schema.get`을 실행한다
  결과  SCH-GET-1.1  현재 스키마를 돌려준다
```

## 2. 스키마 수정 (`schema.update`)

```
SCH-UPD-1  개발 서버에서 스키마를 바꾸고 스키마 파일에 기록한다
  전제  `config.dev`가 `true`이고 초기 스키마 파일이 있다
  행동  새 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-1.1  반환값이 새 스키마이다
        SCH-UPD-1.2  `schema.get`을 실행하면 새 스키마를 돌려준다
        SCH-UPD-1.3  스키마 파일에서 읽은 값이 새 스키마이다

SCH-UPD-2  개발 서버가 아니면 `FORBIDDEN`으로 스키마 수정을 거절한다
  전제  `config.dev`가 `false`이고 초기 스키마 파일이 있다
  행동  새 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-2.1  `FORBIDDEN` 오류를 던진다
        SCH-UPD-2.2  `schema.get`을 실행하면 원래 스키마 그대로이다
        SCH-UPD-2.3  스키마 파일에서 읽은 값이 원래 스키마 그대로이다

SCH-UPD-3  트랜잭션이 실패해 롤백되면 스키마와 스키마 파일은 바뀌지 않는다
  전제  `config.dev`가 `true`이고 초기 스키마 파일이 있다
  행동  `transaction` 안에서 새 스키마로 `schema.update`를 실행한 뒤 오류를 던져 롤백시킨다
  결과  SCH-UPD-3.1  롤백된 뒤 `schema.get`을 실행하면 원래 스키마 그대로이다
        SCH-UPD-3.2  스키마 파일에서 읽은 값이 원래 스키마 그대로이다

SCH-UPD-4  드라이런 안에서 실행하면 스키마와 스키마 파일은 바뀌지 않는다
  전제  `config.dev`가 `true`이고 초기 스키마 파일이 있다
  행동  `dryRun` 안에서 새 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-4.1  `dryRun`이 끝난 뒤 `schema.get`을 실행하면 원래 스키마 그대로이다
        SCH-UPD-4.2  스키마 파일에서 읽은 값이 원래 스키마 그대로이다

SCH-UPD-5  정의되지 않은 필드 종류가 들어 있으면 `BAD_REQUEST`로 스키마 수정을 거절한다
  전제  `config.dev`가 `true`이고 초기 스키마 파일이 있다
  행동  정의된 8종이 아닌 `type`을 가진 필드가 포함된 스키마로 `schema.update`를 실행한다
  결과  SCH-UPD-5.1  `BAD_REQUEST` 오류를 던진다
        SCH-UPD-5.2  `schema.get`을 실행하면 원래 스키마 그대로이다
        SCH-UPD-5.3  스키마 파일에서 읽은 값이 원래 스키마 그대로이다
```

## 3. 설정 조회 (`config.get`)

```
CFG-GET-1  현재 사이트 설정을 돌려준다
  전제  초기 설정으로 엔진이 생성되어 있다
  행동  `config.get`을 실행한다
  결과  CFG-GET-1.1  현재 사이트 설정을 돌려준다
```

## 4. 설정 수정 (`config.update`)

```
CFG-UPD-1  개발 서버에서 사이트 이름을 바꾸고 설정 파일에 기록한다
  전제  `config.dev`가 `true`이고 초기 설정 파일이 있다
  행동  새 `name`으로 `config.update`를 실행한다
  결과  CFG-UPD-1.1  반환값의 `name`이 새 `name`이다
        CFG-UPD-1.2  `config.get`을 실행하면 `name`만 새 `name`으로 바뀐 설정을 돌려준다
        CFG-UPD-1.3  설정 파일의 `name`이 새 `name`으로 바뀐다
        CFG-UPD-1.4  설정 파일에서 `name`을 제외한 나머지 내용은 그대로이다

CFG-UPD-2  개발 서버가 아니면 `FORBIDDEN`으로 설정 수정을 거절한다
  전제  `config.dev`가 `false`이고 초기 설정 파일이 있다
  행동  새 `name`으로 `config.update`를 실행한다
  결과  CFG-UPD-2.1  `FORBIDDEN` 오류를 던진다
        CFG-UPD-2.2  `config.get`을 실행하면 원래 설정 그대로이다
        CFG-UPD-2.3  설정 파일의 내용은 원래 그대로이다

CFG-UPD-3  트랜잭션이 실패해 롤백되면 설정과 설정 파일은 바뀌지 않는다
  전제  `config.dev`가 `true`이고 초기 설정 파일이 있다
  행동  `transaction` 안에서 새 `name`으로 `config.update`를 실행한 뒤 오류를 던져 롤백시킨다
  결과  CFG-UPD-3.1  롤백된 뒤 `config.get`을 실행하면 원래 설정 그대로이다
        CFG-UPD-3.2  설정 파일의 내용은 원래 그대로이다

CFG-UPD-4  드라이런 안에서 실행하면 설정과 설정 파일은 바뀌지 않는다
  전제  `config.dev`가 `true`이고 초기 설정 파일이 있다
  행동  `dryRun` 안에서 새 `name`으로 `config.update`를 실행한다
  결과  CFG-UPD-4.1  `dryRun`이 끝난 뒤 `config.get`을 실행하면 원래 설정 그대로이다
        CFG-UPD-4.2  설정 파일의 내용은 원래 그대로이다
```
