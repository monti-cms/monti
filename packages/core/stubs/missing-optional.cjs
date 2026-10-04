// `withCms`가 설치하지 않은 선택 의존성(예: 블록 확장의 `mermaid`) 대신 잇는 모듈. 그 기능을 쓸 때만 불러오므로
// 불러오면 설치하라고 알린다. CommonJS라서 이름 붙인 import도 빌드를 멈추지 않는다.
throw new Error(
	"[@monti-cms/core] This feature needs an optional package that is not installed. Install it and restart the dev server.",
);
