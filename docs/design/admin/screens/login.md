# 로그인 (Login)

- 보드: `Login.dc.html`. 상태와 흐름: [screens.md › Login](../screens.md#login), [흐름 8](../flows/08-first-install.md).
- 공통 틀: 없다. 사이드바, ✦ 버튼, 페이지 머리가 없는 혼자 선 화면이다. 로그인 전이라 어시스턴트도 없다.

## 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 화면 | `Stack`(가운데 놓인 좁은 폼 하나) | 폼은 `<form>`이고 Enter로 보낸다. |
| 사이트 이름 "example.dev" | `Heading as="h1" variant="page"`, 그 아래 잉크 선 `Box border="bottom-contrast"` | 로고는 없고 이름을 글자로 쓴다. 잉크 선은 편집기 제목 아래 선과 같다. |
| 안내 제목 ("첫 관리자 만들기", "로그인이 설정되지 않았어요") | `Text variant="title"` | 첫 관리자와 로그인 없음에서만 보인다. |
| "이메일" | `FormField` + `FormFieldLabel` + `Input`(`autoComplete="username"`) | 모든 필드가 필수인 짧은 폼이라 `*`를 붙이지 않는다([field.md](../components/field.md)). |
| "비밀번호" | `FormField` + `FormFieldLabel` + `Input type="password"`(로그인은 `current-password`, 첫 관리자는 `new-password`) + `FormFieldError reserve` | 오류 줄은 비어 있어도 자리를 지킨다(아래 4px, 높이 20px). 오류가 떠도 버튼이 움직이지 않는다. 필드와 버튼 사이는 12px다. 틀리면 `aria-invalid`와 오류 한 줄("이메일 또는 비밀번호가 맞지 않아요.", "1분 뒤에 다시 시도해 주세요.", "10자 이상이어야 해요."). 첫 관리자의 길이 조건 "10자 이상"은 플레이스홀더로 말한다. 보드는 이것을 필드 아래 설명 줄로 그리지만 [field.md](../components/field.md)를 따라 플레이스홀더로 옮긴다. |
| "비밀번호 확인" | `FormField` + `FormFieldLabel` + `Input type="password"`(`new-password`) + `FormFieldError reserve` | 첫 관리자에서만. 비밀번호 필드와 16px 떨어진다. 다르면 "두 비밀번호가 같지 않아요." |
| "로그인" · "생성" | `Button variant="primary" width="full"` | 화면의 검은 알약 하나. 잠긴 동안 `disabled`. 보내는 동안 `loading`. |
| "또는" 줄 | `Separator label="또는"` | 비밀번호와 GitHub가 둘 다 있을 때만. |
| "GitHub로 로그인" | `Button width="full"`(앞에 GitHub 아이콘: auth가 주는 이름 `logo--github`를 `iconsByName`으로 찾아 버튼 글자색으로 그린다). 비밀번호 폼이 있으면 `variant="secondary"`, GitHub만 있으면 `variant="primary"` | GitHub 인증으로 간다. 검은 알약은 화면에 하나다. |
| GitHub 권한 없음 | `FormFieldError`(필드 밖에서도 쓴다) "octo-kim은 관리자가 아니에요.", 그 아래 `TextButton` "다른 계정으로 로그인" | |
| 이미 관리자가 있음 | 빨간 한 줄 "이미 관리자가 있어요.", `Button variant="secondary"` "로그인하기" | 로그인 화면으로 간다. |
| 버전 "Monti 0.2" | `Text variant="micro" tone="faint"` | 화면 맨 아래. |

스토리: Primitives/Stack, Primitives/Box, Primitives/Text, Controls/Field/Field, Controls/Field/Input, Controls/Button/Button, Controls/Button/TextButton.

## 흐름 8 · 처음 설치

단계: 8.01, 8.02, 8.04, 8.05, 8.06, 8.07, 8.08, 8.09, 8.10. 단계마다 보이는 것은 [flows/08-first-install.md](../flows/08-first-install.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `attempt` "처음" | 8.05 | 이메일, 비밀번호, "로그인", "또는", "GitHub로 로그인"(secondary) |  |
| "한 번 틀림" | 8.06 | 비밀번호 `aria-invalid`, `FormFieldError` "이메일 또는 비밀번호가 맞지 않아요." | Controls/Field/Field |
| "잠김" | 8.07 | `FormFieldError` "1분 뒤에 다시 시도해 주세요.", "로그인" `disabled` | Controls/Field/Field |
| "첫 관리자" | 8.01 | 안내 제목 "첫 관리자 만들기", 이메일, 비밀번호(플레이스홀더 "10자 이상"), 비밀번호 확인, "생성". GitHub 줄은 없다. |  |
| "첫 관리자 오류" | 8.02 | 비밀번호 `FormFieldError` "10자 이상이어야 해요.", 확인 `FormFieldError` "두 비밀번호가 같지 않아요." | Controls/Field/Field |
| "이미 있음" | 8.04 | `FormFieldError` "이미 관리자가 있어요."와 "로그인하기" `Button variant="secondary"`만 | Controls/Field/Field › FormError, Controls/Button/Button |
| "GitHub만" | 8.08 | "GitHub로 로그인" `Button variant="primary"`만 | Controls/Button/Button |
| "GitHub 권한 없음" | 8.09 | "GitHub로 로그인"(primary), `FormFieldError`, "다른 계정으로 로그인" `TextButton` | Controls/Field/Field › FormError |
| "로그인 없음" | 8.10 | 안내 제목 "로그인이 설정되지 않았어요"만. 폼도 버튼도 없다. |  |
