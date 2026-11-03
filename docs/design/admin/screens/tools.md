# 도구 (Data, ApiKeys, Events)

도구 화면 셋(데이터, 활동 기록, API 키)은 같은 틀을 쓴다.

## 도구 틀 (세 화면 공통)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 사이드바 | 공통 틀([common.md](common.md)), 현재 위치 "도구" |  |
| 페이지 단 | `PageColumn` | 데이터와 API 키는 `width="content"`, 활동 기록은 `width="list"`. |
| 제목 행 "도구" | `PageHeader` | API 키 화면만 검은 알약 하나("+ 키 추가"). 데이터와 활동 기록은 머리에 알약이 없다. |
| 탭 "템플릿 · 데이터 · 활동 기록 · API 키" | `PageToolbar` 안의 `TabLinks` + `TabLink` | 탭 하나가 페이지 하나다. 개수는 `TabLink count`("템플릿 3"), 실패한 전송 수는 `countTone="warning"`("활동 기록 1"). 플러그인이 더한 도구 페이지도 탭이 된다. |
| ✦ 어시스턴트 열기 | 공통 틀 | 사이드 패널이 열린 동안에는 가려진다. |

## 데이터 (Data)

- 보드: `Data.dc.html`. 상태와 흐름: [screens.md › Data](../screens.md#data), [흐름 9](../flows/09-data.md).
- 공통 틀: 도구 틀, 시트, 토스트.

### 기본 틀

#### 페이지

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "백업" 절, "가져오기" 절 | `Section` | 왼쪽 제목, 오른쪽 내용. |
| "백업 받기" | `Button variant="primary"` | 누르면 고를 것 없이 바로 만든다. 만드는 동안 `loading`, 라벨은 "만드는 중 64%". |
| "마지막 백업 10. 20" | `Text variant="note" tone="subtle"`, 날짜는 `mono` | 없으면 "없음". |
| "미디어 파일도 담기 2.1 GB" | `Option` + `Checkbox`, 크기는 그 메모 | 기본은 꺼짐. 바로 적용되는 설정이 아니라 이번 백업의 선택이라 체크박스다. |
| "zip 파일 고르기" | `Button variant="secondary"`, 뒤에 숨은 `Input type="file" srOnly` | 파일을 고르거나 놓으면 읽기 시작한다. 옆에 받는 종류 `Text variant="meta" tone="subtle"`("Monti 백업 · .md/.mdx 묶음"). |
| 고른 파일 줄 | 파일 이름 `Text variant="note" mono`, 그 옆 상태 `Text variant="note"`("읽는 중…" `tone="subtle"`, "읽지 못했어요" `tone="danger"`) |  |

스토리: Patterns/Frame/Section, Controls/Button/Button, Primitives/Text, Controls/Choice/Option, Controls/Choice/Checkbox, Controls/Field/Input, Controls/Overlay/Sheet, Controls/Field/Field, Patterns/List/MapRow, Controls/Field/Select, Controls/Choice/Segmented, Controls/Choice/Switch, Controls/Button/TextButton.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 가져오기 · 복원 시트

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시트 | `Sheet`(`SheetContent`, `SheetHeader`, `SheetBody`, `SheetFooter`) | 일하는 동안(가져오는 중, 복원 중) `closable={false}`. |
| 제목 | `SheetTitle of`(파일 이름, `ofMono`) | "가져오기 · blog-export.zip", "있던 그대로 복원 · monti-backup-1020.zip". |
| 찾은 것 요약 | `Text`("글 24편을 찾았어요"), 그 아래 `Text variant="note" tone="subtle"` | 건너뛰기와 -2 규칙을 한 줄로. |
| "들어갈 곳" | `FormField` + `FormFieldLabel`, 행은 `MapRow`(`name` "posts/", `example` "24편", 자식 `Select`) | 폴더마다 어느 컬렉션으로 갈지. |
| "필드 맞추기 · 게시글" | `FormField` + `MapRow` 여럿(`name` 파일의 키, `example` 예시 값, `warning` "새 태그 4개가 생겨요", 가져오지 않는 키는 `off`, 자식 `Select`) | 어시스턴트가 맞춘 선택은 `Select`의 `proposal`(파랑). 고르면 보통 색. |
| "발행" | `FormField` + `Segmented size="sm" inline`("모두 초안" · "원래대로") |  |
| "이미지" | `FormField`, 문장 `Text`, "바깥 이미지 6개도 옮기기" `Option spread` + `Switch` |  |
| "알아 두세요" | `FormField`, 문장 `Text`(컴포넌트 이름은 `mono`) |  |
| 가져온 뒤 | `Text variant="heading"` "21편을 가져왔어요.", 그 아래 `Text tone="subtle"` | 주소를 바꾼 글 목록은 아래 "부품 없음". |
| 복원 요약, 복원 막힘 문제 목록 | 아래 "부품 없음" | 막힌 문제는 경고색 줄로 적는다. 아무것도 쓰지 않았다는 문장 하나. |
| 발 | `SheetFooter`: "취소" `TextButton`, 알약 `Button variant="primary"`("21편 가져오기", 일하는 동안 `loading` "가져오는 중 12/21", "복원", "복원하는 중…", 막히면 `disabled`). 가져온 뒤에는 왼쪽 "되돌리기" `TextButton`, 알약 "목록에서 보기"(`href`). | 알약은 하나다. |

### 흐름 9 · 데이터

단계: 9.01, 9.02, 9.03, 9.05, 9.06, 9.07, 9.08, 9.09, 9.11, 9.12, 9.13, 9.14, 9.15. 단계마다 보이는 것은 [flows/09-data.md](../flows/09-data.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `stage` "기본" | 9.01 | 두 절 |  |
| "백업 중" | 9.02 | "백업 받기" `Button loading` "만드는 중 64%" | Controls/Button/Button |
| "백업 받음" | 9.03 | `toast` "백업을 저장했어요", 마지막 백업 "오늘 09:12" | Controls/Status/Toast |
| "읽는 중" | 9.05 | 파일 줄 "읽는 중…" |  |
| "못 읽음" | 9.11 | 파일 줄 "읽지 못했어요"(`tone="danger"`) |  |
| "가져오기" | 9.06 | 시트: 요약, "들어갈 곳", "필드 맞추기" |  |
| "가져오기 아래" | 9.07 | 시트 아래쪽: "발행", "이미지", "알아 두세요" |  |
| "가져오는 중" | 9.08 | 시트 `closable={false}`, 알약 `loading` "가져오는 중 12/21" |  |
| "가져옴" | 9.09 | 시트: 결과 문장, 주소를 바꾼 글 목록, 발 "되돌리기" · "목록에서 보기" |  |
| "복원" | 9.12 | 시트 "있던 그대로 복원": 백업 요약, 알약 "복원". 사이드바 `fresh`(빈 사이트) |  |
| "복원 막힘" | 9.13 | 시트: 문제 목록, 알약 `disabled` |  |
| "복원 중" | 9.14 | 시트 `closable={false}`, 알약 `loading` "복원하는 중…" |  |
| "복원함" | 9.15 | `toast` "글 148편을 복원했어요"와 `action` "목록 보기" | Controls/Status/Toast |

### 부품 없음

보드에 있지만 `@monti-cms/ui`에 아직 없는 것이다. 화면에서 만들지 않고, 먼저 부품을 만든다.

- `.mt-map` 두 열 모양(`.mt-map-row` 두 칸): 복원 요약("글 148 · 초안 12 …"), 복원 막힘의 문제 줄, 가져온 뒤 "주소를 바꾼 글"(누르면 그 글로 가는 행). [field.md](../components/field.md)는 "요약 표는 같은 행을 두 열로 쓴다"고 하지만 `MapRow`에는 두 열 모양이 없다(늘 `Select` 칸을 받는다). 먼저 부품에 더한다. 활동 기록의 가져오기 자세히 패널도 같은 모양을 쓴다.

## API 키 (ApiKeys)

- 보드: `ApiKeys.dc.html`. 상태와 흐름: [screens.md › ApiKeys](../screens.md#apikeys), [흐름 10](../flows/10-api-keys.md).
- 공통 틀: 도구 틀, 작은 폼 창, 확인 질문, 알림 띠, 토스트.

### 기본 틀

#### 페이지

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "+ 키 추가" | `Button variant="primary"`(앞 아이콘 +) | 서비스 고르기 창을 연다. 서버 비밀값이 없으면 `disabled`. |
| 알림 띠 | `Banner`(`title` "키 3개를 읽을 수 없어요" 또는 "키를 저장할 수 없어요", 문장 안의 `MONTI_SECRET`은 `mono`) | 목록 바로 위, 단 안에 둔다. |
| 표 묶음 "저장된 키" · "모델" · "플러그인" | `TableSection`(`title`, `count`, 기다리는 키가 있으면 `countTone="warning"`) | 첫 표는 도구 줄 아래 32, 다음은 40. |
| 저장된 키 한 행 | `TableSectionRow`(`title` 키 이름, `titleCount` "··· a1b2", `detail` 사용량 "이번 달 1.24M 토큰", 쓰지 않았으면 `metaTone="faint"`와 `muted`, 읽을 수 없으면 `metaTone="danger"` "읽을 수 없어요"), `actions`에 "편집" `TextButton variant="underline"`과 "지우기" `TextButton variant="quiet"` | 행이 없으면 "없음" 한 줄을 흐리게. 키 값은 끝 네 글자만 보인다. |
| "빠른 작업" 모델 | `TableSectionRow`(`title` "빠른 작업", `detail` 쓰는 곳), `control`에 `MenuField`(`value` 모델 `mono`, `meta` 키 이름)를 트리거로 둔 `ModelMenu layout="field"` | 열면 검색 행과 키별 묶음, 지금 모델에 ✓. 고르면 바로 적용하고 토스트. "최근" 묶음과 생각 행은 없다. 키가 하나도 없으면 `MenuField placeholder="키 없음"` `disabled`. 모델이 많아 검색이 먼저인 메뉴로 고른다. |
| 플러그인 키 자리 | `TableSectionRow`(`title` 플러그인 이름, 자리가 여럿이면 뒤에 "· 검색 키", `detail` 플러그인 코드 `mono`), `control`에 `MenuField`(`value` 키 이름, `meta` "··· 4410", 비었으면 `placeholder` "키 없음"과 `warning`) | 키가 없을 때 누르면 그 서비스가 골라진 "키 추가" 창이 열린다(`onClick`). 비밀값이 없으면 흐리고 누를 수 없지만 펼침 표시는 남는다. |

스토리: Controls/Button/Button, Patterns/Frame/Banner, Patterns/List/TableSection, Controls/Button/TextButton, Controls/Menu/ModelMenu, Controls/Overlay/Dialog, Controls/Menu/PickList, Controls/Overlay/DialogFormFooter, Controls/Field/Field, Controls/Field/Select, Primitives/Text, Controls/Field/Input, Controls/Field/SecretInput, Controls/Overlay/AlertDialog, Patterns/Frame/DescriptionList.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 창

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 서비스 고르기 "키 추가" | `Dialog`(`DialogContent`, `DialogHeader`, `DialogTitle`), 목록 `PickList`(`aria-label` "서비스") 안에 `PickListLabel` "AI" · "플러그인", `PickListItem`(덧말은 `mark`: "Ollama", "bareun"), 묶음 사이 `PickListSeparator`. 발은 `DialogFooter`에 "취소" `TextButton` | 서비스를 고르면 바로 키 입력 창이 된다. 알약이 없다. |
| 키 추가 · 편집 창 | `Dialog` + `DialogFormFooter`(`submitLabel` "추가" 또는 "저장", 확인하는 동안 `busy`와 `busyLabel` "확인하는 중…") | 포커스는 첫 텍스트 필드로 간다. 편집 창의 제목은 `DialogTitle of`("편집 · Anthropic 개인"). |
| "서비스" | 추가 창은 `FormField` + `Select`, 편집 창과 플러그인 자리는 `FormField`에 글로만 `Text` |  |
| "주소" (OpenAI 호환) | `FormField` + `FormFieldLabel required` + `Input mono` |  |
| "이름" | `FormField` + `FormFieldLabel required` + `Input` | 서비스 이름으로 채워진다. 같은 이름이 있으면 "Anthropic 2"로 채우고 아래 `FormFieldDescription` "이름이 Anthropic인 키가 이미 있어요." |
| "키" (새 값) | `FormField` + `FormFieldLabel`(호환 주소와 편집이 아니면 `required`) + `SecretInput` | 눈 버튼으로 보이고 가린다. 거절되면 `aria-invalid`와 `FormFieldError` "맞지 않는 키예요." 호환 주소는 플레이스홀더 "없음". 값을 지우려면 필드를 비운다. |
| "키" (저장된 값, 편집) | `SavedValue`(`··· a1b2`, `action` "바꾸기") | "바꾸기"를 누르면 그 자리가 `SecretInput keep`(끝에 "그대로")이 된다. 높이가 같아 아래가 움직이지 않는다. 읽을 수 없는 키는 처음부터 `SecretInput`이고 아래 `FormFieldDescription` "키를 다시 넣어 주세요." |
| 지우기 확인 | `AlertDialog`(`AlertDialogTitle` "Anthropic 개인을 지울까요?", `AlertDialogDescription` "되돌릴 수 없어요. …"), 쓰는 곳은 `DescriptionList` + `DescriptionItem`(모델 `mono`), `AlertDialogCancel` "취소", `AlertDialogAction` `Button variant="danger"` "지우기" | 쓰는 곳이 없으면 목록 없이 "되돌릴 수 없어요." 한 줄. |

### 흐름 10 · API 키

단계: 10.01, 10.02, 10.02b, 10.03, 10.04, 10.05, 10.06, 10.07, 10.08, 10.09, 10.10, 10.11, 10.11b, 10.12, 10.12b, 10.13, 10.13b, 10.14, 10.14b, 10.15. 단계마다 보이는 것은 [flows/10-api-keys.md](../flows/10-api-keys.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "서비스 고르기" | 10.01 | 서비스 고르기 `Dialog` + `PickList` | Controls/Overlay/Dialog, Controls/Menu/PickList |
| "키 입력" | 10.02 | 추가 창: "서비스" `Select`, "이름", "키" `SecretInput`(포커스) | Controls/Field/Select, Controls/Field/SecretInput |
| "호환 주소" | 10.02b | 추가 창에 "주소" `Input mono`, 이름은 호스트("localhost:11434"), 키 플레이스홀더 "없음" | Controls/Field/Input |
| "확인하는 중" | 10.03 | `DialogFormFooter busy` "확인하는 중…" | Controls/Overlay/DialogFormFooter |
| "키 거절" | 10.04 | 키 `aria-invalid`와 `FormFieldError`, 창은 열린 채 | Controls/Field/Field |
| "이름 겹침" | 10.05 | 이름 "Anthropic 2"와 `FormFieldDescription` | Controls/Field/Field |
| "추가됨" | 10.06 | 새 `TableSectionRow`, `toast` "키를 추가했어요" | Patterns/List/TableSection, Controls/Status/Toast |
| "편집" | 10.07 | 편집 창: 서비스는 글, 키는 `SavedValue` | Controls/Field/SecretInput |
| "편집 키 열기" | 10.08 | 키 자리가 `SecretInput keep`("그대로") | Controls/Field/SecretInput |
| "편집 확인 중" | 10.09 | `SecretInput keep`, `DialogFormFooter busy` | Controls/Field/SecretInput, Controls/Overlay/DialogFormFooter |
| "편집 저장됨" | 10.10 | 행의 끝 네 글자 "7c0e", `toast` "저장했어요" | Controls/Status/Toast |
| "지우기 확인" | 10.11 | `AlertDialog`와 쓰는 곳 `DescriptionList` | Controls/Overlay/AlertDialog, Patterns/Frame/DescriptionList |
| "쓰는 곳 없이 지우기" | 10.11b | `AlertDialog`, 목록 없음 | Controls/Overlay/AlertDialog |
| "키 넣기" | 10.12 | 플러그인 자리의 `MenuField`가 열린 모양, 서비스가 정해진 추가 창(서비스는 글) | Controls/Menu/ModelMenu |
| "키 넣음" | 10.12b | 플러그인 자리에 키 이름과 끝 네 글자, 저장된 키 표에 새 행, `toast` "바른 맞춤법에 키를 넣었어요" | Controls/Status/Toast |
| "모델 고르기" | 10.13 | `ModelMenu layout="field"`가 열림 | Controls/Menu/ModelMenu |
| "모델 바뀜" | 10.13b | 빠른 작업 값 "gpt-5-mini · OpenAI 회사", `toast` "빠른 작업 모델을 바꿨어요" | Controls/Status/Toast |
| "읽을 수 없음" | 10.14 | `Banner` "키 3개를 읽을 수 없어요", 행마다 `metaTone="danger"` "읽을 수 없어요" | Patterns/Frame/Banner |
| "다시 넣기" | 10.14b | 편집 창: 키가 처음부터 `SecretInput`(포커스, `required`), `FormFieldDescription` "키를 다시 넣어 주세요." | Controls/Field/SecretInput, Controls/Field/Field |
| "비밀값 없음" | 10.15 | `Banner` "키를 저장할 수 없어요", "+ 키 추가" `disabled`, 저장된 키 "없음", 빠른 작업 `MenuField` `disabled`, 플러그인 자리 흐림 | Patterns/Frame/Banner, Controls/Menu/ModelMenu |

## 활동 기록 (Events)

- 보드: `Events.dc.html`. 상태와 흐름: [screens.md › Events](../screens.md#events), [흐름 12](../flows/12-activity-log.md).
- 공통 틀: 도구 틀, 사이드 패널, 확인 질문, 알림 띠, 토스트, 메뉴.

### 기본 틀

#### 목록

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 걸린 필터 | `Chip`(`onRemove`, `removeLabel` "필터 지우기"): "글: 첫 번째 글", "전송: 실패" | 탭 줄 오른쪽(`PageToolbarEnd`). ×로 그 필터만 뺀다. |
| "종류 ▾" | `FilterButton`(값이 있으면 `filled`, "종류: AI 제안") + `DropdownMenu`: 종류마다 `DropdownMenuRadioItem`(앞 아이콘, AI 제안은 `Spark`), 구분선, "전송" `DropdownMenuSub`("대기" · "보냄" · "실패" · "취소됨", 끝에 개수 `MenuShortcut`) | 전송 값을 고르면 `Chip`이 된다. 보드의 행 메뉴 카드(`.mt-menu--ctx`)는 필터 버튼이 여는 메뉴이므로 `DropdownMenu`로 그린다. |
| 실패 알림 | `Banner tone="danger"`(`title` "전송 실패 N건", `meta` 날짜), 끝에 "보기" `TextButton variant="underline"`(실패 필터가 이미 걸렸으면 없다)과 "모두 다시 보내기" `TextButton` | 목록 바로 위, 단 안에. 보내는 동안 "모두 다시 보내기"는 `TextButton loading` "보내는 중…"이고 다시 누를 수 없다. 실패는 빨강이다. |
| 날짜 묶음 "오늘 · 10. 26" | `Text variant="meta" tone="subtle"`, 표 안쪽 12px에 맞춘다 |  |
| 목록 | `Table` + `TableBody` + `TableRow` + `TableCell`, 아래 `ListFooter`와 `Pagination` | 행 어디를 눌러도 자세히 패널이 열린다(`RowLink`). 열린 행은 `selected`. |
| 시각 | `TableCell` 안 `Text variant="meta" mono tone="subtle"` |  |
| 무엇 · 어디 | `Text`(잉크) 두 줄: 무엇 "“더 짧게 다듬어 줘…”", 아래 `Text variant="meta" tone="subtle" truncate` "어시스턴트 제안 · 첫 번째 글 · 본문 5곳". AI 제안은 앞에 `Text tone="proposal"` 안의 `Icon icon={Spark}` |  |
| 끝 동작 | AI 제안: "대화" `TextButton variant="quiet" size="note"`(`href`), "되돌리기" `TextButton variant="underline" size="note"`. 결과 글 "되돌림 · 10:44" `Text variant="note" tone="subtle"`. 실패한 전송: `EntryStatus status="failed"` "실패", `Text variant="meta"` "3번 실패", "다시 보내기" `TextButton variant="underline" size="note"`. 기다리는 전송: `Text variant="note"` "보내는 중". | 한 행에 할 수 있는 것만 보인다. |
| 빈 목록 | 한 줄 `Text tone="subtle"`("실패한 전송이 없어요", "아직 기록이 없어요"), 거른 결과가 비었으면 뒤에 "필터 끄기" `TextButton variant="underline" size="note"` | 할 일이 없으므로 한 줄로 충분하다. |

스토리: Patterns/Frame/PageHeader, Patterns/List/FilterButton, Controls/Menu/DropdownMenu, Primitives/AI mark, Patterns/Frame/Banner, Controls/Button/TextButton, Primitives/Text, Patterns/List/Table, Patterns/List/Pagination, Primitives/Icon, Controls/Status/EntryStatus, Controls/Overlay/SidePanel, Patterns/Frame/DescriptionList, Controls/Button/Button, Controls/Overlay/AlertDialog.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 자세히 패널과 창

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 자세히 패널 | `SidePanel width="side"`(`title` "\"첫 번째 글\" 발행", 머리 끝 닫기) | 목록 옆에 붙고 ✦ 버튼을 가린다. 목록을 보면서 쓰므로 시트가 아니라 사이드 패널이다. |
| 묶음 "이벤트" · "항목" · "전송 · 2" | `Heading variant="label"`, 그 아래 `DescriptionList` + `DescriptionItem`("언제", "한 사람", "ID", "글", "컬렉션", "언어", "주소", "받는 곳", "상태", "시도 횟수", "마지막 오류") | 글 이름은 `TextButton variant="underline"`(`href`), 시각 · ID · 주소 · 오류는 `mono`. 전송 상태는 `EntryStatus`(`failed` "실패", `published` "보냄"). |
| 전송 동작 | "다시 보내기" `TextButton variant="underline"`, "취소" `TextButton variant="quiet"` | 받는 곳마다 그 아래. |
| 가져오기 자세히 | `SidePanel width="side"`(`title` "blog-export.zip 가져옴"), `DescriptionList`, "주소를 바꾼 글 · 2"(데이터의 "부품 없음"), `footer`에 "되돌리기" `TextButton`과 "목록에서 보기" `Button variant="primary"`(`href`) |  |
| 전송 취소 확인 | `AlertDialog`(`AlertDialogTitle` "이 전송을 취소할까요?", `AlertDialogDescription`의 받는 곳 `mono`), `AlertDialogCancel` "닫기", `AlertDialogAction` `Button variant="danger"` "취소하기" | 버튼 이름이 하는 일을 말한다("닫기" · "취소하기"). |

### 흐름 2 · 어시스턴트

단계: 2.17, 2.18. 단계마다 보이는 것은 [flows/02-assistant.md](../flows/02-assistant.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `stage` "기본" | 2.17, 2.18 | 거르지 않은 목록, 실패 1건 `Banner`, 탭 "활동 기록 1" | Patterns/Frame/Banner |
| `filter` "전체" · "전송 실패" · "글 하나" | 2.17, 2.18 | "전송 실패"는 "실패만"과 같다. "글 하나"는 `Chip` "글: 첫 번째 글", `FilterButton filled` "종류: AI 제안" | Patterns/List/FilterButton |

### 흐름 9 · 데이터

단계: 9.10. 단계마다 보이는 것은 [flows/09-data.md](../flows/09-data.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `stage` "기본" | 9.10 | 거르지 않은 목록, 실패 1건 `Banner`, 탭 "활동 기록 1" | Patterns/Frame/Banner |
| `filter` "전체" · "전송 실패" · "글 하나" | 9.10 | "전송 실패"는 "실패만"과 같다. "글 하나"는 `Chip` "글: 첫 번째 글", `FilterButton filled` "종류: AI 제안" | Patterns/List/FilterButton |
| `withImport` · `importDetail` | 9.10 | 가져오기 행, 가져오기 자세히 `SidePanel` | Controls/Overlay/SidePanel |

### 흐름 12 · 활동 기록

단계: 12.01, 12.01b, 12.02, 12.02b, 12.03, 12.04, 12.04b, 12.05, 12.06, 12.07, 12.08, 12.09, 12.09b, 12.10, 12.11. 단계마다 보이는 것은 [flows/12-activity-log.md](../flows/12-activity-log.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "실패만" | 12.01b | `Chip` "전송: 실패", 실패한 행만, `Banner`에 "보기" 없음 | Patterns/Frame/Banner |
| "다시 보내는 중" | 12.02 | 그 행의 "다시 보내기"가 "보내는 중…"(다시 누를 수 없음) |  |
| "다시 보냄" | 12.02b | 빈 목록 "실패한 전송이 없어요" + "필터 끄기", `toast` "보냈어요", 알림 없음 | Controls/Status/Toast |
| "자세히" | 12.03 | 자세히 `SidePanel`(이벤트 · 항목 · 전송 · 2), 그 행 `selected`, ✦ 가려짐 | Controls/Overlay/SidePanel |
| "취소 확인" | 12.04 | 자세히 패널 위 `AlertDialog` | Controls/Overlay/AlertDialog |
| "취소됨" | 12.04b | 그 행의 결과 "취소됨"(흐림), `toast` "전송을 취소했어요" | Controls/Status/Toast |
| "실패 알림" | 12.01 | `Banner` "전송 실패 1건" + "보기" · "모두 다시 보내기" | Patterns/Frame/Banner |
| "실패 3건" | 12.05 | 실패한 행 셋(각 "N번 실패"), `Banner` "전송 실패 3건", 탭 개수 3 | Patterns/Frame/Banner |
| "모두 보내는 중" | 12.06 | `Banner`의 "모두 다시 보내기"와 실패한 행들이 "보내는 중…" | Patterns/Frame/Banner |
| "모두 보냄" | 12.07 | 알림 없음, `toast` "3건 보냈어요" | Controls/Status/Toast |
| "일부 실패" | 12.08 | `Banner` "전송 실패 1건", 남은 행 "1번 실패", `toast` "2건 보냈어요 · 1건 실패" | Patterns/Frame/Banner, Controls/Status/Toast |
| "필터 메뉴" | 12.09 | "종류" `DropdownMenu`와 "전송" `DropdownMenuSub`가 열림 | Controls/Menu/DropdownMenu |
| "필터 걸림" | 12.09b | `Chip` "전송: 대기", 기다리는 행만 |  |
| "구독자 없음" | 12.10 | 전송 열이 없는 행들(기록만), 알림 없음 |  |
| "비어 있음" | 12.11 | 빈 목록 "아직 기록이 없어요" |  |
| `filter` "전체" · "전송 실패" · "글 하나" | 12.01, 12.01b, 12.02, 12.02b, 12.03, 12.04, 12.04b, 12.05, 12.06, 12.07, 12.08, 12.09, 12.09b, 12.10, 12.11 | "전송 실패"는 "실패만"과 같다. "글 하나"는 `Chip` "글: 첫 번째 글", `FilterButton filled` "종류: AI 제안" | Patterns/List/FilterButton |

### 부품 없음

보드에 있지만 `@monti-cms/ui`에 아직 없는 것이다. 화면에서 만들지 않고, 먼저 부품을 만든다.

- `.mt-map` 두 열 모양: 가져오기 자세히의 "주소를 바꾼 글"(데이터와 같다).
