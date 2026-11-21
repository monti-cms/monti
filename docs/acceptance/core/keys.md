# `resources/keys/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 5절(`Plugin.keyServices`), 6절(`api_keys`), 7절(`keys` 리소스)의 인수 조건이다.

- `keys.create`: `service`, `name`, `secret`(모두 빈 문자열 불가)을 받아 암호화 비밀값(`secret`)으로 `secret`을 암호화해 `api_keys`에 저장하고, 원문 `secret` 없이 `id`, `service`, `name`, `last4`(끝 4자리)를 돌려준다. 엔진에 암호화 비밀값(`secret`)이 설정되어 있지 않거나 필수 문자열이 비어 있으면 `BAD_REQUEST`, 같은 `name`이 이미 있으면 `CONFLICT`로 거절한다.
- `keys.list`: 저장된 키들의 `id`, `service`, `name`, `last4` 목록을 돌려준다.
- `keys.update`: `id`와 `name`(빈 문자열 불가), 선택 `secret`(전달 시 빈 문자열 불가)을 받아 이름을 바꾸고, `secret`이 함께 주어지면 암호화 비밀값으로 암호문과 `last4`도 바꾼다. `name`이나 `secret`이 빈 문자열이거나 `secret`을 바꾸는데 엔진에 암호화 비밀값이 없으면 `BAD_REQUEST`, 다른 키와 `name`이 겹치면 `CONFLICT`, 없는 `id`이면 `NOT_FOUND`로 거절한다.
- `keys.delete`: `id`로 해당 키를 삭제한다. 없는 `id`이면 `NOT_FOUND`로 거절한다.
- `keys.check`: 새로 입력한 `{ service, secret }` 또는 저장된 키의 `{ id }`(암호화 비밀값으로 저장된 `secret`을 복호화해 사용)로 플러그인 `keyServices`의 연결 확인 함수를 실행하고 `{ ok: true }`를 돌려준다. 저장된 키를 쓰는데 엔진에 암호화 비밀값이 없거나 연결 확인이 거절하면 `BAD_REQUEST`, 등록되지 않은 `service`이거나 없는 `id`이면 `NOT_FOUND`로 거절한다.

---

## 1. 생성 (`create`)

```
KEY-CRT-1  키를 암호화해 저장하고 끝 4자리를 돌려준다
  전제  `api_keys`가 비어 있다
  행동  `service`, `name`, `secret`으로 `keys.create`를 실행한다
  결과  KEY-CRT-1.1  반환값에 `id`, `service`, `name`이 들어 있다
        KEY-CRT-1.2  반환값의 `last4`가 `secret`의 끝 4자리이다
        KEY-CRT-1.3  반환값에 `secret`은 들어 있지 않다
        KEY-CRT-1.4  `api_keys`에 해당 `id`의 행이 하나 생긴다
        KEY-CRT-1.5  `api_keys`에 저장된 `secret`은 평문 `secret`과 다르다

KEY-CRT-2  같은 이름의 키가 이미 있으면 새 키를 만들 수 없다
  전제  키가 하나 저장되어 있다
  행동  기존 키와 같은 `name`으로 `keys.create`를 실행한다
  결과  KEY-CRT-2.1  `CONFLICT` 오류를 던진다
        KEY-CRT-2.2  `api_keys`의 행은 원래 하나 그대로이다

KEY-CRT-3  암호화 비밀값이 없으면 키를 저장할 수 없다
  전제  암호화 비밀값(`secret`)이 설정되지 않은 엔진이고 `api_keys`가 비어 있다
  행동  `service`, `name`, `secret`으로 `keys.create`를 실행한다
  결과  KEY-CRT-3.1  `BAD_REQUEST` 오류를 던진다
        KEY-CRT-3.2  `api_keys`가 비어 있다

KEY-CRT-4  서비스·이름·비밀값 중 하나라도 빈 문자열이면 키를 저장할 수 없다
  전제  `api_keys`가 비어 있다
  행동  `service`, `name`, `secret` 중 하나를 빈 문자열(`""`)로 넣어 `keys.create`를 실행한다
  결과  KEY-CRT-4.1  `BAD_REQUEST` 오류를 던진다
        KEY-CRT-4.2  `api_keys`가 비어 있다
```

## 2. 목록 (`list`)

```
KEY-LST-1  저장된 키들의 원문 비밀값을 제외한 목록을 돌려준다
  전제  서로 다른 키 두 개가 저장되어 있다
  행동  `keys.list`를 실행한다
  결과  KEY-LST-1.1  두 키의 `id`, `service`, `name`, `last4` 목록을 돌려준다
        KEY-LST-1.2  반환된 각 항목에 `secret`은 들어 있지 않다
```

## 3. 수정 (`update`)

```
KEY-UPD-1  이름과 새 비밀값을 함께 주면 이름과 키를 모두 바꾼다
  전제  연결 확인 함수를 가진 플러그인이 등록되어 있고, 해당 `service`의 키가 하나 저장되어 있다
  행동  해당 `id`와 새 `name`, 새 `secret`으로 `keys.update`를 실행한다
  결과  KEY-UPD-1.1  반환값의 `name`이 새 `name`이다
        KEY-UPD-1.2  반환값의 `last4`가 새 `secret`의 끝 4자리이다
        KEY-UPD-1.3  `api_keys`의 `name`과 `last4`가 새 값으로 바뀐다
        KEY-UPD-1.4  해당 `id`로 `keys.check`를 실행하면 연결 확인 함수가 새 `secret`으로 호출된다

KEY-UPD-2  비밀값 없이 이름만 주면 이름만 바꾸고 기존 키는 유지한다
  전제  연결 확인 함수를 가진 플러그인이 등록되어 있고, 해당 `service`의 키가 하나 저장되어 있다
  행동  해당 `id`와 새 `name`만으로 `keys.update`를 실행한다
  결과  KEY-UPD-2.1  반환값의 `name`이 새 `name`이다
        KEY-UPD-2.2  반환값의 `last4`는 기존 값 그대로이다
        KEY-UPD-2.3  `api_keys`의 `name`이 새 `name`이다
        KEY-UPD-2.4  해당 `id`로 `keys.check`를 실행하면 연결 확인 함수가 기존 원문 `secret`으로 호출된다

KEY-UPD-3  다른 키와 이름이 겹치면 이름을 바꿀 수 없다
  전제  서로 다른 이름의 키 두 개가 저장되어 있다
  행동  두 번째 키의 `id`와 첫 번째 키의 `name`으로 `keys.update`를 실행한다
  결과  KEY-UPD-3.1  `CONFLICT` 오류를 던진다
        KEY-UPD-3.2  두 번째 키의 `name`은 바뀌지 않는다

KEY-UPD-4  존재하지 않는 키는 수정할 수 없다
  전제  `api_keys`가 비어 있다
  행동  존재하지 않는 `id`와 새 `name`으로 `keys.update`를 실행한다
  결과  KEY-UPD-4.1  `NOT_FOUND` 오류를 던진다

KEY-UPD-5  암호화 비밀값이 없으면 저장된 키의 비밀값을 바꿀 수 없다
  전제  키가 하나 저장되어 있고 암호화 비밀값(`secret`)이 설정되지 않은 엔진이다
  행동  저장된 키의 `id`, 새 `name`, 새 `secret`으로 `keys.update`를 실행한다
  결과  KEY-UPD-5.1  `BAD_REQUEST` 오류를 던진다
        KEY-UPD-5.2  `api_keys`에서 해당 키의 `name`, `secret`, `last4`가 원래 그대로이다

KEY-UPD-6  이름이나 비밀값을 빈 문자열로 바꿀 수 없다
  전제  키가 하나 저장되어 있다
  행동  저장된 키의 `id`와 빈 `name: ""` 또는 빈 `secret: ""`로 `keys.update`를 실행한다
  결과  KEY-UPD-6.1  `BAD_REQUEST` 오류를 던진다
        KEY-UPD-6.2  `api_keys`에서 해당 키의 `name`, `secret`, `last4`가 원래 그대로이다
```

## 4. 삭제 (`delete`)

```
KEY-DEL-1  지정한 키만 지운다
  전제  서로 다른 키 두 개가 저장되어 있다
  행동  첫 번째 키의 `id`로 `keys.delete`를 실행한다
  결과  KEY-DEL-1.1  `api_keys`에 두 번째 키 하나만 남아 있다

KEY-DEL-2  존재하지 않는 키는 지울 수 없다
  전제  `api_keys`가 비어 있다
  행동  존재하지 않는 `id`로 `keys.delete`를 실행한다
  결과  KEY-DEL-2.1  `NOT_FOUND` 오류를 던진다
```

## 5. 연결 확인 (`check`)

```
KEY-CHK-1  서비스와 비밀값으로 플러그인의 연결 확인 함수를 실행한다
  전제  연결 확인 함수가 통과하는 플러그인이 등록되어 있다
  행동  등록된 `service`와 `secret`으로 `keys.check`를 실행한다
  결과  KEY-CHK-1.1  플러그인의 연결 확인 함수가 해당 `secret`으로 호출된다
        KEY-CHK-1.2  `{ ok: true }`를 돌려준다

KEY-CHK-2  저장된 키 ID로 실행하면 비밀값을 복호화해 연결 확인 함수를 실행한다
  전제  연결 확인 함수가 통과하는 플러그인이 등록되어 있고, 해당 `service`의 키가 하나 저장되어 있다
  행동  저장된 키의 `id`로 `keys.check`를 실행한다
  결과  KEY-CHK-2.1  플러그인의 연결 확인 함수가 복호화된 원문 `secret`으로 호출된다
        KEY-CHK-2.2  `{ ok: true }`를 돌려준다

KEY-CHK-3  연결 확인 함수가 실패하면 연결 확인을 거절한다
  전제  연결 확인 함수가 거절하는 플러그인이 등록되어 있다
  행동  등록된 `service`와 `secret`으로 `keys.check`를 실행한다
  결과  KEY-CHK-3.1  `BAD_REQUEST` 오류를 던진다

KEY-CHK-4  등록되지 않은 서비스의 키는 연결을 확인할 수 없다
  전제  등록된 `keyServices`가 없다
  행동  등록되지 않은 `service`와 `secret`으로 `keys.check`를 실행한다
  결과  KEY-CHK-4.1  `NOT_FOUND` 오류를 던진다

KEY-CHK-5  존재하지 않는 키 ID로는 연결을 확인할 수 없다
  전제  `api_keys`가 비어 있다
  행동  존재하지 않는 `id`로 `keys.check`를 실행한다
  결과  KEY-CHK-5.1  `NOT_FOUND` 오류를 던진다

KEY-CHK-6  암호화 비밀값이 없으면 저장된 키 ID로 연결을 확인할 수 없다
  전제  키가 하나 저장되어 있고 암호화 비밀값(`secret`)이 설정되지 않은 엔진이다
  행동  저장된 키의 `id`로 `keys.check`를 실행한다
  결과  KEY-CHK-6.1  `BAD_REQUEST` 오류를 던진다
```
