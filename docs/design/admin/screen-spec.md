# 화면 명세

화면을 데이터(`*.screen.json`)로 적고, `@monti-cms/ui`의 `ScreenSpec`이 디자인 시스템 부품으로 그린다. 명세가 중심이고, 명세의 모양은 디자인 도구를 따르지 않는다. 지금은 로그인의 첫 상태 하나로 시범 중이다.

## 형식

- 평평한 요소 표: `root`와 `elements`. 요소는 `type`(부품), `props`, `children`, `slots`(패턴의 칸), `visible`을 가진다.
- 값: 그냥 값, `{ "data": "/경로" }`(화면 데이터), `{ "text": "키", "params": {…} }`(화면의 사전), `{ "action": "이름" }`(페이지가 넘기는 동작).
- `visible`: `{ "data" }`(값이 있으면 보임), `{ "not": … }`.
- `className`, `style`, 픽셀 숫자는 없다.

## 빈 공간: Spacing

- 빈 공간은 컨테이너(`Stack`) `children` 안의 `{ "spacing": 20 }` 하나로만 쓴다. 크기는 간격 토큰(2·4·6·8·10·12·16·20·24·32·40·48)만 된다.
- 두 요소 사이에 있으면 그 사이 간격, 맨 앞이나 맨 끝에 있으면 컨테이너 축의 안쪽 여백이다. 두 개를 연달아 쓰지 않는다.
- 축은 컨테이너 방향이 정한다(`column`은 높이, `row`는 너비). 옆 여백은 패턴이 고정값으로 가진다. 패턴이 없는 한 번뿐인 상자는 방향이 다른 두 `Stack`을 겹쳐 쓰고, `ScreenSpec`이 한 요소로 합친다(`px-monti-24 py-monti-16`).
- 사이 Spacing은 뒤 요소와 함께 숨는다.
- 그릴 때 토큰 클래스로 바뀐다: 맨 앞·끝은 컨테이너의 padding, 사이가 모두 같으면 컨테이너의 gap, 아니면 다음 요소의 margin. 빈 칸 요소는 없다.
- 부품은 바깥 여백을 갖지 않는다. 되풀이되는 컨테이너의 여백은 부품이 가지고, 다른 여백은 부품의 variant가 된다.

## 카탈로그와 검사

- `packages/ui/src/spec/parts.tsx`에 명세가 쓸 수 있는 부품을 적는다. `pnpm gen:screen-catalog`가 그 부품들의 실제 prop 타입을 읽어 `screen-catalog.generated.json`을 만든다. 선택지는 타입의 유니언 그대로다.
- `pnpm check:screens`(CI)는 모든 `*.screen.json`을 검사한다. 없는 부품, 없는 prop, 없는 값, 없는 칸, 토큰 밖 Spacing, 연달은 Spacing은 요소와 자리를 적고 실패한다.
- `ScreenSpec`은 그리기 전에 같은 검사를 하고, 문제가 있거나 사전에 없는 글자 키, 페이지가 주지 않은 동작이 나오면 멈춘다. 몰래 건너뛰지 않는다.

## 서버

`ScreenSpec`은 hook과 context가 없는 함수라 서버 컴포넌트에서 그린다. 브라우저에서 도는 코드는 각 부품 안에만 있다.
