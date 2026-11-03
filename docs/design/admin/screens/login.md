# 로그인 (Login)

- 보드: `Login.dc.html`. 상태와 흐름: [screens.md › Login](../screens.md#login), [흐름 8](../flows/08-first-install.md).
- 공통 틀: 없다. 사이드바, ✦ 버튼, 페이지 머리가 없는 혼자 선 화면이다. 로그인 전이라 어시스턴트도 없다.

## 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 화면 | `Stack`(가운데 놓인 좁은 폼 하나) | 폼은 `<form>`이고 Enter로 보낸다. |
| 사이트 이름 "example.dev" | `Heading as="h1" variant="page"` | 아래에 잉크 선 하나. 로고는 없고 이름을 글자로 쓴다. |
| 안내 제목 ("첫 관리자 만들기", "로그인이 설정되지 않았어요") | `Text variant="title"` | 첫 관리자와 로그인 없음에서만 보인다. |
| "이메일" | `FormField` + `FormFieldLabel` + `Input`(`autoComplete="username"`) | 모든 필드가 필수인 짧은 폼이라 `*`를 붙이지 않는다([field.md](../components/field.md)). |
| "비밀번호" | `FormField` + `FormFieldLabel` + `Input type="password"`(로그인은 `current-password`, 첫 관리자는 `new-password`) + `FormFieldError` | 틀리면 `aria-invalid`와 오류 한 줄("이메일 또는 비밀번호가 맞지 않아요.", "1분 뒤에 다시 시도해 주세요.", "10자 이상이어야 해요."). 첫 관리자의 길이 조건 "10자 이상"은 플레이스홀더로 말한다. 보드는 이것을 필드 아래 설명 줄로 그리지만 [field.md](../components/field.md)를 따라 플레이스홀더로 옮긴다. |
| "비밀번호 확인" | `FormField` + `FormFieldLabel` + `Input type="password"`(`new-password`) + `FormFieldError` | 첫 관리자에서만. 다르면 "두 비밀번호가 같지 않아요." |
| "로그인" · "생성" | `Button variant="primary" width="full"` | 화면의 검은 알약 하나. 잠긴 동안 `disabled`. 보내는 동안 `loading`. |
| "또는" 줄 | 아래 "빠진 부품" | 비밀번호와 GitHub가 둘 다 있을 때만. |
| "GitHub로 로그인" | `Button width="full"`(앞에 GitHub 아이콘). 비밀번호 폼이 있으면 `variant="secondary"`, GitHub만 있으면 `variant="primary"` | GitHub 인증으로 간다. 검은 알약은 화면에 하나다. |
| GitHub 권한 없음 | `FormFieldError`와 같은 빨간 한 줄 "octo-kim은 관리자가 아니에요.", 그 아래 `TextButton` "다른 계정으로 로그인" | |
| 이미 관리자가 있음 | 빨간 한 줄 "이미 관리자가 있어요.", `Button variant="secondary"` "로그인하기" | 로그인 화면으로 간다. |
| 버전 "Monti 0.2" | `Text variant="micro" tone="faint"` | 화면 맨 아래. |

## 상태

| 상태 · prop | 더해지는 것 |
|---|---|
| `attempt` "처음" | 이메일, 비밀번호, "로그인", "또는", "GitHub로 로그인"(secondary) |
| "한 번 틀림" | 비밀번호 `aria-invalid`, `FormFieldError` "이메일 또는 비밀번호가 맞지 않아요." |
| "잠김" | `FormFieldError` "1분 뒤에 다시 시도해 주세요.", "로그인" `disabled` |
| "첫 관리자" | 안내 제목 "첫 관리자 만들기", 이메일, 비밀번호(플레이스홀더 "10자 이상"), 비밀번호 확인, "생성". GitHub 줄은 없다. |
| "첫 관리자 오류" | 비밀번호 `FormFieldError` "10자 이상이어야 해요.", 확인 `FormFieldError` "두 비밀번호가 같지 않아요." |
| "이미 있음" | 빨간 한 줄과 "로그인하기" `Button variant="secondary"`만 |
| "GitHub만" | "GitHub로 로그인" `Button variant="primary"`만 |
| "GitHub 권한 없음" | "GitHub로 로그인"(primary), 빨간 한 줄, "다른 계정으로 로그인" `TextButton` |
| "로그인 없음" | 안내 제목 "로그인이 설정되지 않았어요"만. 폼도 버튼도 없다. |
| `dark` | 어두운 테마. |

## 빠진 부품

- "또는" 구분 줄(양쪽에 선, 가운데 `text-caption` "또는"): 보드에 DS 클래스가 없고 `@monti-cms/ui`에도 없다. `Separator`는 글자를 가운데 담지 못한다. 먼저 부품을 만든다.
- 필드 밖의 빨간 한 줄(`.mt-error`를 폼 아래에 따로 쓴 것: "GitHub 권한 없음", "이미 있음"): `FormFieldError`는 필드에 묶인 오류다. 폼 전체의 오류 한 줄을 그릴 부품을 정해야 한다.
