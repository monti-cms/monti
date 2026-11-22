import type { OperationSpec } from "@monti-cms/core";
import { propertyNames, propertyTypes } from "./json-schema";

/** 두 칸 표의 한 줄: 왼쪽에 명령·옵션, 오른쪽에 설명. */
type Row = readonly [string, string];

/** 도움말의 한 절: 제목과 두 칸 표. */
type Section = readonly [string, readonly Row[]];

const commands: Row[] = [
	["<resource> <action> [options]", "코어·플러그인 작업 실행"],
	["<resource> [<action>] --help", "리소스·작업별 옵션 도움말 출력"],
	["spec", "모든 작업의 명세를 JSON으로 출력"],
	["migrate generate [name] [--dry-run]", "스키마 변경분으로 SQL 마이그레이션 파일 생성"],
	["migrate status", "마이그레이션 적용 상태 출력"],
	["migrate up [--dry-run]", "미적용 마이그레이션을 운영 DB에 적용"],
	["clean-files", "임시 파일 정리"],
];

const globalOptions: Row[] = [
	["--config <path>", "설정 파일 경로 (기본: ./monti.config.ts)"],
	["--schema <path>", "스키마 파일 경로 (기본: ./monti.schema.ts)"],
	["--migrations <dir>", "마이그레이션 폴더 경로 (기본: ./migrations)"],
	["--help, -h", "도움말 출력"],
	["--version, -v", "버전 출력"],
];

const inputOption: Row = ["--input <json|->", "입력 전체를 JSON으로 전달 (-이면 표준 입력에서 읽기)"];

const dryRunOption: Row = ["--dry-run", "실행 결과만 확인하고 저장하지 않기"];

const kindLabels: Record<OperationSpec["kind"], string> = { read: "읽기", write: "쓰기" };

/** 두 칸 표: 왼쪽 칸을 가장 긴 값에 맞춰 채운다. */
function columns(rows: readonly Row[]): string[] {
	const width = Math.max(...rows.map(([left]) => left.length));
	return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`);
}

/** 도움말 글: 사용법 줄 아래에 절마다 빈 줄, 제목, 표를 붙인다. 줄이 없는 절(입력이 없는 작업의 "입력")은 뺀다. */
function helpText(usage: string, sections: readonly Section[]): string {
	const shown = sections.filter(([, rows]) => rows.length > 0);
	return [usage, ...shown.flatMap(([title, rows]) => ["", title, ...columns(rows)])].join("\n");
}

/** 입력 속성 하나의 줄: 개별 옵션 이름과, 받는 타입을 `string | null`처럼 이은 것(타입을 정하지 않은 속성은 `any`). */
function inputRow(input: Record<string, unknown>, name: string): Row {
	return [`--${name}`, [...propertyTypes(input, name)].join(" | ") || "any"];
}

/** 전체 도움말: 명령과 전역 옵션. */
export function formatGlobalHelp(): string {
	return helpText("사용법: monti <command> [options]", [
		["명령", commands],
		["전역 옵션", globalOptions],
	]);
}

/** 리소스 도움말: `resource`의 작업 이름과 읽기·쓰기 구분. */
export function formatResourceHelp(resource: string, specs: readonly OperationSpec[]): string {
	const prefix = `${resource}.`;
	const actions = specs
		.filter((spec) => spec.name.startsWith(prefix))
		.map((spec): Row => [spec.name.slice(prefix.length), kindLabels[spec.kind]]);
	return helpText(`사용법: monti ${resource} <action> [options]`, [["작업", actions]]);
}

/** 작업 도움말: 입력 속성마다 개별 옵션과 받는 타입, 그리고 `--input`과 (쓰기 작업이면) `--dry-run`. */
export function formatOperationHelp(spec: OperationSpec): string {
	const inputs = propertyNames(spec.input).map((name) => inputRow(spec.input, name));
	const options = spec.kind === "write" ? [inputOption, dryRunOption] : [inputOption];
	const usage = `사용법: monti ${spec.name.replace(".", " ")} [options]\n${kindLabels[spec.kind]} 작업`;
	return helpText(usage, [
		["입력", inputs],
		["옵션", options],
	]);
}
