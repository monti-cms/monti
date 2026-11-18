# `resources/admin/` · `resources/session/` 인수조건

[`docs/refactor/core.md`](../../refactor/core.md) 6절(`monti_admin`, `monti_session`)과 7절(`admin`, `session` 리소스)의 인수조건이다.

- `admin.create`: 관리자가 없을 때 첫 관리자와 세션을 만든다. 이미 관리자가 있으면 `CONFLICT`로 거절한다.
- `admin.update`: 현재 비밀번호를 확인한 뒤 이메일과 비밀번호를 바꾸고 기존 세션을 모두 지운다.
- `session.create`: 이메일과 비밀번호가 맞으면 세션을 발급하고, 원문 토큰 대신 `token_hash`와 미래 시각의 `expires_at`을 저장한다.
- `session.get`: 유효한 토큰이면 관리자의 `id`와 `email`을 돌려주고, 만료되었거나 없는 토큰이면 `{ admin: null }`을 돌려준다.
- `session.delete`: 해당 토큰의 세션 행만 삭제한다.

---

```
AUTH-1  관리자가 없을 때 admin.create는 첫 관리자와 세션을 만든다
  전제  monti_admin이 비어 있다
  행동  이메일과 비밀번호로 admin.create를 실행한다
  결과  AUTH-1.1  반환값에 관리자의 id와 email이 들어 있다
        AUTH-1.2  반환값에 세션 token이 들어 있다
        AUTH-1.3  monti_admin에 해당 이메일의 행이 하나 생긴다
        AUTH-1.4  저장된 password_hash는 평문 비밀번호와 다르다
        AUTH-1.5  반환된 token으로 session.get을 실행하면 { admin: { id, email } }을 돌려준다

AUTH-2  관리자가 이미 있을 때 admin.create는 CONFLICT로 거절한다
  전제  admin.create로 관리자가 하나 만들어져 있다
  행동  다시 admin.create를 실행한다
  결과  AUTH-2.1  CONFLICT 오류를 던진다
        AUTH-2.2  monti_admin의 행은 원래 하나 그대로이다

AUTH-3  admin.update는 현재 비밀번호가 맞으면 이메일과 비밀번호를 바꾸고 기존 세션을 모두 지운다
  전제  관리자가 하나 있고, 발급된 세션이 두 개 있다
  행동  맞는 현재 비밀번호와 새 이메일, 새 비밀번호로 admin.update를 실행한다
  결과  AUTH-3.1  반환값의 email이 새 이메일이다
        AUTH-3.2  monti_session의 기존 세션 행이 모두 삭제된다
        AUTH-3.3  새 이메일과 새 비밀번호로 session.create를 실행하면 세션 token을 돌려준다
        AUTH-3.4  새 이메일과 이전 비밀번호로 session.create를 실행하면 UNAUTHORIZED 오류를 던진다

AUTH-4  admin.update는 현재 비밀번호가 틀리면 UNAUTHORIZED로 거절한다
  전제  관리자가 하나 있다
  행동  틀린 현재 비밀번호와 새 이메일, 새 비밀번호로 admin.update를 실행한다
  결과  AUTH-4.1  UNAUTHORIZED 오류를 던진다
        AUTH-4.2  monti_admin의 이메일이 바뀌지 않는다
        AUTH-4.3  monti_admin의 password_hash가 바뀌지 않는다

AUTH-5  session.create는 이메일과 비밀번호가 맞으면 세션을 발급한다
  전제  관리자가 하나 있다
  행동  맞는 이메일과 비밀번호로 session.create를 실행한다
  결과  AUTH-5.1  반환값에 세션 token이 들어 있다
        AUTH-5.2  monti_session에 원문 token과 다른 token_hash가 저장된다
        AUTH-5.3  저장된 expires_at은 현재 시각보다 미래이다

AUTH-6  session.create는 비밀번호가 틀리면 UNAUTHORIZED로 거절한다
  전제  관리자가 하나 있다
  행동  맞는 이메일과 틀린 비밀번호로 session.create를 실행한다
  결과  AUTH-6.1  UNAUTHORIZED 오류를 던진다

AUTH-7  session.create는 등록되지 않은 이메일이면 UNAUTHORIZED로 거절한다
  전제  관리자가 하나 있다
  행동  등록되지 않은 이메일과 기존 관리자의 비밀번호로 session.create를 실행한다
  결과  AUTH-7.1  UNAUTHORIZED 오류를 던진다

AUTH-8  session.get은 유효한 토큰에 대해 관리자를 돌려준다
  전제  관리자가 하나 있고, session.create로 발급받은 유효한 토큰이 있다
  행동  해당 토큰으로 session.get을 실행한다
  결과  AUTH-8.1  { admin: { id, email } }을 돌려준다

AUTH-9  session.get은 만료된 토큰에 대해 { admin: null }을 돌려준다
  전제  관리자가 하나 있고, expires_at이 과거인 세션이 있다
  행동  만료된 토큰으로 session.get을 실행한다
  결과  AUTH-9.1  { admin: null }을 돌려준다

AUTH-10  session.get은 존재하지 않는 토큰에 대해 { admin: null }을 돌려준다
  전제  관리자가 하나 있다
  행동  존재하지 않는 토큰으로 session.get을 실행한다
  결과  AUTH-10.1  { admin: null }을 돌려준다

AUTH-11  session.delete는 해당 토큰의 세션만 지운다
  전제  관리자가 하나 있고, 서로 다른 세션 두 개가 발급되어 있다
  행동  첫 번째 토큰으로 session.delete를 실행한다
  결과  AUTH-11.1  첫 번째 토큰으로 session.get을 실행하면 { admin: null }을 돌려준다
        AUTH-11.2  두 번째 토큰으로 session.get을 실행하면 여전히 해당 관리자를 돌려준다
```
