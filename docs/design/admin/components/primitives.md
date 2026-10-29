# 기본 부품

이 페이지는 다른 모든 부품을 이루는 작은 부품을 다룬다. 배치 부품(`Box`, `Stack`, `Inline`), 글자(`Text`, `Heading`), 아이콘(`Icon`), 폼 라벨(`Label`), 사이의 선(`Separator`), 부품이 스스로 쓰는 말(`UiLabelsProvider`), 사람이 넓힐 수 있는 단(`ResizablePane`)이다. 토큰 말고는 제 모양이 없다. 색, 글자, 간격, 크기는 [tokens.md](tokens.md)에 있다. 화면은 이 부품으로 배치하고 글을 쓰며, 클래스를 쓰지 않는다. 이 부품으로 말할 수 없는 것은 따로 부품이 된다.

## 배치 (`.mt-stack`)

상자는 자식을 담을 뿐 다른 일은 하지 않는다. 선택지는 모두 토큰 이름이라서, 간격, 여백, 너비는 척도의 한 단계만 될 수 있다.

- `Box`는 배치 선택지만 가진다(여백, 면, 테두리, 모서리, 크기, 넘침). 자식을 한 행이나 한 열로 놓으려면 같은 선택지를 받는 `Stack`이나 `Inline`을 쓴다.
- `Stack`은 자식을 열로(또는 행으로) 놓는다. 간격은 간격 척도의 한 단계로, px로 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48 중 하나다. 기본값은 12다.
- `Inline`은 행으로 놓는 `Stack`이고, 기본으로 교차축 가운데에 맞춘다. 아이콘과 그 라벨, 툴바 같은 것이다.
- 선택지로 말할 수 없는 것(토큰이 없는 값)이 필요한 행이나 상자에는 클래스를 주지 않는다. 그것은 부품이 된다.

### 코드

`Box`, `Stack`, `Inline`은 `LAYOUT`(`packages/ui/src/layout.ts`)의 선택지를 함께 쓰고, `Grid`도 같이 쓴다. `padding={16}`, `background="tool"`, `radius="lg"`, `width="sheet"`. `className`이나 `style`은 받지 않는다.

## 글자

글자는 언제나 [tokens.md](tokens.md)의 글자 역할 중 하나로 쓴다. 역할이 크기, 줄 높이, 굵기를 함께 정한다. 역할을 크기와 굵기로 다시 만들지 않는다.

- `Text`는 역할을 `variant`로 받고(`micro`, `meta`, `caption`, `note`, `label`, `body`, `title`, `reading`, `heading`, `page`, `display`), 뜻에 따른 색을 `tone`으로 받는다(`default`, `muted`, `subtle`, `faint`, `proposal`, `danger`, `warning`, `success`).
- `weight`는 역할 안에서 한 구간을 강조할 때만 쓴다(`medium`, `semibold`). 컨트롤(버튼, 입력, 메뉴)은 이미 자기 역할이 있어서 그냥 글자를 받는다.
- 역할이 있는 다른 글자 안에 놓인 `Text`가 자기 `variant`를 갖지 않으면 `body` 대신 바깥 역할을 따른다. 제목 안의 구간은 제목 크기를 지키고, 캡션 안의 굵은 낱말은 캡션 크기로 남는다.
- `Heading`은 제목 역할로 쓰는 제목이다. `title`은 섹션, 패널, 대화상자의 제목이고(기본), `page`는 화면의 제목, `heading`은 글 안의 제목, `display`는 글 제목, `label`은 패널이나 시트 안의 작은 제목이다.
- `Text`는 긴 줄을 "…"로 자르고(`truncate`, 또는 `lines`에 2나 3), 글의 원래 줄바꿈을 지키고(`preserveLines`), 스크린 리더만 읽게 할 수도 있다(`srOnly`).

### 코드

`Text`(`variant`, `tone`, `weight`, `mono`, `truncate`, `lines`, `italic`, `preserveLines`, `align`, `srOnly`)와 `Heading`(`as`는 `h1`부터 `h4`까지, `variant`는 역할).

## 아이콘

버튼 밖의 아이콘이다. 심각도 표시, 파일 종류, 힌트 같은 것이다. 아이콘 크기와 모양 고르기는 [tokens.md](tokens.md)에 있다.

- 크기는 이름으로 정한다. 12, 14, 16(기본), 20px 중 하나다. 색은 `tone`으로 정한다(muted, subtle, danger, warning, success). tone이 없으면 옆 글자를 따른다.
- `label`이 없으면 장식이고, 있으면 그 이름을 가진 이미지가 된다.

### 코드

`Icon`: `icon`은 모양(Carbon 아이콘, 어시스턴트는 `Spark`), `size`는 `xs`, `sm`, `md`, `lg` 중 하나, 그리고 `tone`과 `label`.

## 폼 라벨 (`.mt-label`)

필드 위의 이름이다. 흐린 잉크의 mono 11이다(`micro` 역할). 폼 안에서 라벨이 어떻게 놓이는지는 필드 페이지가 다룬다(필드 참고).

- `size`와 `tone`은 체크박스의 라벨처럼 글로 읽히는 라벨에 다른 역할을 고른다. `hidden`은 라벨을 스크린 리더에만 남긴다.
- `required`는 선택 필드도 있는 폼에서 라벨 끝에 빨간 `*`를 글자 뒤 2px에 붙인다. 모든 필드가 필수인 폼과 늘 값을 가진 셀렉트에는 표시를 하지 않는다. 별표는 장식이다. 컨트롤 자체가 `required`를 가진다.

### 코드

`Label`: `size`, `tone`, `hidden`, `required`. 라벨이 붙은 필드에는 `FormField`와 `FormFieldLabel`을 쓴다(필드 참고).

## 구분선 (`.mt-line`, `.mt-vr`)

행 사이나 컨트롤 사이의 선이다.

- 가로선은 1px다. 행 사이의 선은 조용한 행 선(`border-muted`)이다.
- 툴바에서 두 컨트롤 사이의 세로선은 1 × 14px `border-default` 선이고, 가운데에 놓는다.

### 코드

`Separator`: `orientation`은 `horizontal`(기본)이나 `vertical`이다. 세로선에서 `length="full"`은 행 높이만큼 늘이고, `length="control"`은 툴바 가운데에 놓는 14px 선이다.

## 부품이 쓰는 말 (`UiLabelsProvider`)

몇몇 부품은 말을 스스로 쓴다. 스크린 리더 이름이나 기본 버튼 라벨이다(닫기, 지우기, 취소, 저장, 로딩, 쪽 나누기 말 같은 것). 기본은 영어다. 앱은 provider로 자기 언어를 넘기므로, 디자인 시스템은 번역 라이브러리에 기대지 않는다.

### 코드

`UiLabelsProvider`는 `labels`를 받는다. `UiLabels`의 어느 부분이든 된다. 관리자 화면은 자기 메시지 사전에서 이것을 넘긴다(`AdminUiLabels`). `useUiLabels`는 이것을 읽고, `DEFAULT_UI_LABELS`는 영어 기본값을 담는다.

## 크기를 바꾸는 단

사람이 너비를 바꿀 수 있는 단이다. 상세 옆의 목록 같은 것이다. 손잡이는 한쪽 가장자리에 있고, 그 반대쪽에 가는 선이 있다. 너비는 기억되고, 단에는 가장 작은 너비와 가장 큰 너비가 있다.

### 코드

`ResizablePane`: `resizeKey`는 기억할 너비의 이름이다(두 곳에서 같은 키를 쓰면 너비 하나를 함께 쓴다). `defaultWidth`, `min`, `max`는 px이고, `label`은 손잡이의 이름, `edge`는 손잡이가 있는 쪽이다(`end`가 기본이며 오른쪽 가장자리다). 마스터-디테일 화면은 목록에 이것을 쓴다.
