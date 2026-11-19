# `resources/schema/` · `resources/config/` 인수조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.5절(`ReadContext`, `WriteContext`, `MontiConfig`), 4절(컨텍스트와 설정), 7절(`schema`, `config` 리소스), 8절(`state.ts`, `schema-file.ts`, `config-file.ts`)의 인수조건이다.

- `schema.get`: 현재 스키마(`ctx.schema`)를 돌려준다.
- `schema.update`: 개발 서버에서만 스키마를 바꾸고, 커밋 뒤에 공유 상태와 스키마 파일에 반영한다. 필드는 정의된 8종(`text`·`number`·`boolean`·`date`·`select`·`media`·`relation`·`conditional`)과 그 옵션(`required`·`max`·`options`·`many`·`to`·`label`·`description`)을 따르며, 정의되지 않은 `type`은 `BAD_REQUEST`로 거절한다. 개발 서버가 아니면 `FORBIDDEN`으로 거절한다. 롤백이나 `dryRun`이면 공유 상태와 스키마 파일은 바뀌지 않는다.
- `config.get`: 현재 사이트 설정(`ctx.config`)을 돌려준다.
- `config.update`: 개발 서버에서만 사이트 `name`을 바꾸고, 커밋 뒤에 공유 상태와 설정 파일에 반영한다. 개발 서버가 아니면 `FORBIDDEN`으로 거절한다. 롤백이나 `dryRun`이면 공유 상태와 설정 파일은 바뀌지 않는다.

---

```
SCH-1  schema.get은 현재 스키마를 돌려준다
  전제  초기 스키마로 엔진이 생성되어 있다
  행동  schema.get을 실행한다
  결과  SCH-1.1  현재 스키마를 돌려준다

SCH-2  개발 서버에서 schema.update는 스키마를 바꾸고 스키마 파일에 기록한다
  전제  config.dev가 true이고 초기 스키마 파일이 있다
  행동  새 스키마로 schema.update를 실행한다
  결과  SCH-2.1  반환값이 새 스키마이다
        SCH-2.2  schema.get을 실행하면 새 스키마를 돌려준다
        SCH-2.3  스키마 파일에서 읽은 값이 새 스키마이다

SCH-3  개발 서버가 아닐 때 schema.update는 FORBIDDEN으로 거절한다
  전제  config.dev가 false이고 초기 스키마 파일이 있다
  행동  새 스키마로 schema.update를 실행한다
  결과  SCH-3.1  FORBIDDEN 오류를 던진다
        SCH-3.2  schema.get을 실행하면 원래 스키마 그대로이다
        SCH-3.3  스키마 파일에서 읽은 값이 원래 스키마 그대로이다

SCH-4  schema.update가 들어 있는 transaction이 실패해 롤백되면 스키마와 스키마 파일은 바뀌지 않는다
  전제  config.dev가 true이고 초기 스키마 파일이 있다
  행동  transaction 안에서 새 스키마로 schema.update를 실행한 뒤 오류를 던져 롤백시킨다
  결과  SCH-4.1  롤백된 뒤 schema.get을 실행하면 원래 스키마 그대로이다
        SCH-4.2  스키마 파일에서 읽은 값이 원래 스키마 그대로이다

SCH-5  dryRun 안에서 schema.update를 실행하면 스키마와 스키마 파일은 바뀌지 않는다
  전제  config.dev가 true이고 초기 스키마 파일이 있다
  행동  dryRun 안에서 새 스키마로 schema.update를 실행한다
  결과  SCH-5.1  dryRun이 끝난 뒤 schema.get을 실행하면 원래 스키마 그대로이다
        SCH-5.2  스키마 파일에서 읽은 값이 원래 스키마 그대로이다

SCH-6  config.get은 현재 사이트 설정을 돌려준다
  전제  초기 설정으로 엔진이 생성되어 있다
  행동  config.get을 실행한다
  결과  SCH-6.1  현재 사이트 설정을 돌려준다

SCH-7  개발 서버에서 config.update는 사이트 name을 바꾸고 설정 파일에 기록한다
  전제  config.dev가 true이고 초기 설정 파일이 있다
  행동  새 name으로 config.update를 실행한다
  결과  SCH-7.1  반환값의 name이 새 name이다
        SCH-7.2  config.get을 실행하면 name만 새 name으로 바뀐 설정을 돌려준다
        SCH-7.3  설정 파일의 name이 새 name으로 바뀐다
        SCH-7.4  설정 파일에서 name을 제외한 나머지 내용은 그대로이다

SCH-8  개발 서버가 아닐 때 config.update는 FORBIDDEN으로 거절한다
  전제  config.dev가 false이고 초기 설정 파일이 있다
  행동  새 name으로 config.update를 실행한다
  결과  SCH-8.1  FORBIDDEN 오류를 던진다
        SCH-8.2  config.get을 실행하면 원래 설정 그대로이다
        SCH-8.3  설정 파일의 내용은 원래 그대로이다

SCH-9  config.update가 들어 있는 transaction이 실패해 롤백되면 설정과 설정 파일은 바뀌지 않는다
  전제  config.dev가 true이고 초기 설정 파일이 있다
  행동  transaction 안에서 새 name으로 config.update를 실행한 뒤 오류를 던져 롤백시킨다
  결과  SCH-9.1  롤백된 뒤 config.get을 실행하면 원래 설정 그대로이다
        SCH-9.2  설정 파일의 내용은 원래 그대로이다

SCH-10  dryRun 안에서 config.update를 실행하면 설정과 설정 파일은 바뀌지 않는다
  전제  config.dev가 true이고 초기 설정 파일이 있다
  행동  dryRun 안에서 새 name으로 config.update를 실행한다
  결과  SCH-10.1  dryRun이 끝난 뒤 config.get을 실행하면 원래 설정 그대로이다
        SCH-10.2  설정 파일의 내용은 원래 그대로이다

SCH-11  schema.update는 정의되지 않은 필드 type이면 BAD_REQUEST로 거절한다
  전제  config.dev가 true이고 초기 스키마 파일이 있다
  행동  정의된 8종이 아닌 type을 가진 필드가 포함된 스키마로 schema.update를 실행한다
  결과  SCH-11.1  BAD_REQUEST 오류를 던진다
        SCH-11.2  schema.get을 실행하면 원래 스키마 그대로이다
        SCH-11.3  스키마 파일에서 읽은 값이 원래 스키마 그대로이다
```
