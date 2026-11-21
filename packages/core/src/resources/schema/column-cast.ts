/**
 * 열의 데이터 타입을 바꿀 때 `alter column ... type <to> using <식>`에 쓰는 식. DB에 접속하지 않는 순수 함수라 개발
 * 서버의 스키마 동기화와 마이그레이션 CLI가 같은 규칙을 쓴다. 타입 표기는 `format_type`이 돌려주는 표기다.
 *
 * - 글자 → 다건 글자(단건 `select` → 다건 `select`): 값이 있으면 1개짜리 배열로 감싼다.
 * - 다건 글자 → 글자: 첫 원소를 취한다.
 * - 숫자·참거짓·날짜 → 글자: 글자로 바꾼다.
 * - 글자 → 숫자: 숫자 모양인 값만 바꾸고 나머지는 비운다.
 * - 그 밖의 쌍(참거짓 ↔ 숫자, 날짜 ↔ 숫자 등): 호환되지 않으므로 값을 비운다.
 */
/** 값을 그대로 글자로 옮길 수 있는 열 타입: 숫자·참거짓·날짜. */
const toTextFrom: readonly string[] = ["double precision", "boolean", "timestamp with time zone"];

export function castExpression(column: string, from: string, to: string): string {
	const name = `"${column}"`;
	if (from === "text" && to === "text[]") return `case when ${name} is null then null else array[${name}] end`;
	if (from === "text[]" && to === "text") return `${name}[1]`;
	if (toTextFrom.includes(from) && to === "text") return `${name}::text`;
	if (from === "text" && to === "double precision") {
		return `case when ${name} ~ '^\\s*-?[0-9]+(\\.[0-9]+)?\\s*$' then ${name}::double precision else null end`;
	}
	return `null::${to}`;
}
