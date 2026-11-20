# `index.ts` 시작 함수 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 2절(core가 하는 일), 5절(플러그인과 마이그레이션), 8절(`index.ts`)의 인수 조건이다.

- `monti` 객체는 `startMonti`가 돌려주는 것이다. `monti.entries.get(…)`처럼 Operation을 부르고, `monti.spec()`, `monti.transaction(…)`, `monti.dryRun(…)`을 가진다.
- `startMonti({ db, schema, config, schemaFile, configFile })`: 스키마를 검사하고, `config.plugins`와 함께 엔진을 조립한 뒤, 코어 마이그레이션 다음에 플러그인 마이그레이션을 실행해 `monti` 객체를 돌려준다. 스키마와 설정은 부르는 쪽이 파일에서 불러 넘긴다.

---

## 1. 시작 (`startMonti`)

```
START-1  시작하면 코어와 플러그인의 마이그레이션을 코어 먼저 실행한다
  전제  비어 있는 DB와, 코어 테이블을 참조하는 테이블을 만드는 마이그레이션 단계를 가진 플러그인이 있다
  행동  그 플러그인을 `config.plugins`에 넣고 `startMonti({ db, schema, config, schemaFile, configFile })`를 실행한다
  결과  START-1.1  `monti_migrations`에 `"core"` 범위의 단계와 플러그인 이름 범위의 단계가 기록된다
        START-1.2  플러그인 테이블이 만들어져 있다

START-2  `monti` 객체로 코어 리소스와 플러그인 Operation을 모두 실행할 수 있다
  전제  쓰기 Operation 하나를 가진 플러그인이 `config.plugins`에 있다
  행동  `startMonti`로 만든 `monti` 객체로 `folders.create`와 플러그인의 쓰기 Operation을 실행한다
  결과  START-2.1  `folders.create`가 폴더를 만든다
        START-2.2  플러그인의 쓰기 Operation이 실행되어 결과가 반환된다

START-3  스키마에 정의되지 않은 필드 종류가 들어 있으면 마이그레이션 전에 `BAD_REQUEST`로 시작을 거절한다
  전제  비어 있는 DB와, 정의된 8종 밖의 `type`을 가진 필드가 있는 스키마가 있다
  행동  `startMonti`를 실행한다
  결과  START-3.1  `BAD_REQUEST` 오류를 던진다
        START-3.2  `monti_migrations` 테이블이 없다

START-4  플러그인의 키 서비스가 `keys.check`에 연결된다
  전제  확인 함수를 가진 키 서비스를 등록한 플러그인이 `config.plugins`에 있다
  행동  `startMonti`로 시작해 그 서비스 이름과 비밀값으로 `keys.check`를 실행한다
  결과  START-4.1  플러그인의 확인 함수가 그 비밀값으로 호출된다

START-5  `monti` 객체의 명세에 코어의 모든 Operation이 들어 있다
  전제  플러그인 없이 `startMonti`로 만든 `monti` 객체가 있다
  행동  그 `monti` 객체로 `monti.spec()`을 실행한다
  결과  START-5.1  명세의 이름이 `core.md` 7절 표의 `리소스.동작` 전체와 같다(`data`는 코어 밖이라 없다)
```
