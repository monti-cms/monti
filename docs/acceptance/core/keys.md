# `resources/keys/` 인수조건

[`docs/refactor/core.md`](../../refactor/core.md) 5절(`Plugin.keyServices`), 6절(`api_keys`), 7절(`keys` 리소스)의 인수조건이다.

- `keys.create`: `service`, `name`, `secret`을 받아 `secret`을 암호화해 `api_keys`에 저장하고, 원문 `secret` 없이 `id`, `service`, `name`, `last4`(끝 4자리)를 돌려준다. 같은 `name`이 이미 있으면 `CONFLICT`로 거절한다.
- `keys.list`: 저장된 키들의 `id`, `service`, `name`, `last4` 목록을 돌려준다.
- `keys.update`: `id`와 `name`, 선택적 `secret`을 받아 키의 이름을 바꾸고, `secret`이 함께 주어지면 암호문과 `last4`도 바꾼다. 다른 키와 `name`이 겹치면 `CONFLICT`, 없는 `id`이면 `NOT_FOUND`로 거절한다.
- `keys.delete`: `id`로 해당 키를 삭제한다. 없는 `id`이면 `NOT_FOUND`로 거절한다.
- `keys.check`: 새로 입력한 `{ service, secret }` 또는 저장된 키의 `{ id }`(저장된 `secret`을 복호화해 사용)로 플러그인 `keyServices`의 연결 확인 함수를 실행하고 `{ ok: true }`를 돌려준다. 연결 확인 함수가 거절하면 `BAD_REQUEST`, 등록되지 않은 `service`이거나 없는 `id`이면 `NOT_FOUND`로 거절한다.

---

```
KEY-1  keys.create는 키를 암호화해 저장하고 끝 4자리를 돌려준다
  전제  api_keys가 비어 있다
  행동  service, name, secret으로 keys.create를 실행한다
  결과  KEY-1.1  반환값에 id, service, name이 들어 있다
        KEY-1.2  반환값의 last4가 secret의 끝 4자리이다
        KEY-1.3  반환값에 secret은 들어 있지 않다
        KEY-1.4  api_keys에 해당 id의 행이 하나 생긴다
        KEY-1.5  api_keys에 저장된 secret은 평문 secret과 다르다

KEY-2  keys.create는 같은 이름의 키가 이미 있으면 CONFLICT로 거절한다
  전제  키가 하나 저장되어 있다
  행동  기존 키와 같은 name으로 keys.create를 실행한다
  결과  KEY-2.1  CONFLICT 오류를 던진다
        KEY-2.2  api_keys의 행은 원래 하나 그대로이다

KEY-3  keys.list는 저장된 키들의 id, service, name, last4만 돌려준다
  전제  서로 다른 키 두 개가 저장되어 있다
  행동  keys.list를 실행한다
  결과  KEY-3.1  두 키의 id, service, name, last4 목록을 돌려준다
        KEY-3.2  반환된 각 항목에 secret은 들어 있지 않다

KEY-4  keys.update에 name과 새 secret을 함께 주면 이름과 키를 모두 바꾼다
  전제  연결 확인 함수를 가진 플러그인이 등록되어 있고, 해당 service의 키가 하나 저장되어 있다
  행동  해당 id와 새 name, 새 secret으로 keys.update를 실행한다
  결과  KEY-4.1  반환값의 name이 새 name이다
        KEY-4.2  반환값의 last4가 새 secret의 끝 4자리이다
        KEY-4.3  api_keys의 name과 last4가 새 값으로 바뀐다
        KEY-4.4  해당 id로 keys.check를 실행하면 연결 확인 함수가 새 secret으로 호출된다

KEY-5  keys.update에 secret 없이 name만 주면 이름만 바꾸고 기존 키는 유지한다
  전제  연결 확인 함수를 가진 플러그인이 등록되어 있고, 해당 service의 키가 하나 저장되어 있다
  행동  해당 id와 새 name만으로 keys.update를 실행한다
  결과  KEY-5.1  반환값의 name이 새 name이다
        KEY-5.2  반환값의 last4는 기존 값 그대로이다
        KEY-5.3  api_keys의 name이 새 name이다
        KEY-5.4  해당 id로 keys.check를 실행하면 연결 확인 함수가 기존 원문 secret으로 호출된다

KEY-6  keys.update는 다른 키와 이름이 겹치면 CONFLICT로 거절한다
  전제  서로 다른 이름의 키 두 개가 저장되어 있다
  행동  두 번째 키의 id와 첫 번째 키의 name으로 keys.update를 실행한다
  결과  KEY-6.1  CONFLICT 오류를 던진다
        KEY-6.2  두 번째 키의 name은 바뀌지 않는다

KEY-7  keys.update는 없는 id이면 NOT_FOUND로 거절한다
  전제  api_keys가 비어 있다
  행동  존재하지 않는 id와 새 name으로 keys.update를 실행한다
  결과  KEY-7.1  NOT_FOUND 오류를 던진다

KEY-8  keys.delete는 해당 id의 키만 지운다
  전제  서로 다른 키 두 개가 저장되어 있다
  행동  첫 번째 키의 id로 keys.delete를 실행한다
  결과  KEY-8.1  api_keys에 두 번째 키 하나만 남아 있다

KEY-9  keys.delete는 없는 id이면 NOT_FOUND로 거절한다
  전제  api_keys가 비어 있다
  행동  존재하지 않는 id로 keys.delete를 실행한다
  결과  KEY-9.1  NOT_FOUND 오류를 던진다

KEY-10  keys.check는 service와 secret으로 플러그인 keyServices의 연결 확인 함수를 실행한다
  전제  연결 확인 함수가 통과하는 플러그인이 등록되어 있다
  행동  등록된 service와 secret으로 keys.check를 실행한다
  결과  KEY-10.1  플러그인의 연결 확인 함수가 해당 secret으로 호출된다
        KEY-10.2  { ok: true }를 돌려준다

KEY-11  keys.check는 저장된 키의 id로 실행하면 저장된 secret을 복호화해 연결 확인 함수를 실행한다
  전제  연결 확인 함수가 통과하는 플러그인이 등록되어 있고, 해당 service의 키가 하나 저장되어 있다
  행동  저장된 키의 id로 keys.check를 실행한다
  결과  KEY-11.1  플러그인의 연결 확인 함수가 복호화된 원문 secret으로 호출된다
        KEY-11.2  { ok: true }를 돌려준다

KEY-12  keys.check는 연결 확인 함수가 거절하면 BAD_REQUEST로 거절한다
  전제  연결 확인 함수가 거절하는 플러그인이 등록되어 있다
  행동  등록된 service와 secret으로 keys.check를 실행한다
  결과  KEY-12.1  BAD_REQUEST 오류를 던진다

KEY-13  keys.check는 등록되지 않은 service이면 NOT_FOUND로 거절한다
  전제  등록된 keyServices가 없다
  행동  등록되지 않은 service와 secret으로 keys.check를 실행한다
  결과  KEY-13.1  NOT_FOUND 오류를 던진다

KEY-14  keys.check는 없는 id이면 NOT_FOUND로 거절한다
  전제  api_keys가 비어 있다
  행동  존재하지 않는 id로 keys.check를 실행한다
  결과  KEY-14.1  NOT_FOUND 오류를 던진다
```
