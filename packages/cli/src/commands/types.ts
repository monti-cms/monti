import type { ParsedArgs } from "../parse/args";

/** CLI 실행 입출력. `bin.mjs`는 터미널을 넣고, 테스트는 출력을 모으는 함수를 넣는다. */
export interface CliIo {
	/** 명령을 실행한 작업 디렉터리. 설정·스키마 파일, 마이그레이션 폴더, `.env` 파일을 여기서 찾는다. */
	cwd: string;
	/** 실행 환경 변수. 같은 이름이면 `.env.local`·`.env`보다 앞선다. */
	env: Record<string, string | undefined>;
	/** 표준 입력이 대화형 터미널인지. 참일 때만 빠진 필수 민감 필드를 숨김 입력으로 묻는다. */
	isTTY: boolean;
	stdout: (text: string) => void;
	stderr: (text: string) => void;
	/** 표준 입력 전체(`--input -`). */
	readStdin: () => Promise<string>;
	/** `label`을 묻고 화면에 보이지 않게 입력받은 값. */
	promptSecret: (label: string) => Promise<string>;
	/** 설정·스키마 파일을 불러오는 함수. 없으면 `loadProjectFiles`의 기본 로더(jiti)로 불러온다. */
	loader?: (file: string) => Promise<Record<string, unknown>>;
}

/** 명령 하나: 해석한 명령줄과 입출력을 받아 실행하고 결과를 출력한다. */
export type Command = (parsed: ParsedArgs, io: CliIo) => Promise<void>;
