/**
 * MDX 본문의 읽을 수 있는 일반 텍스트. 본문에서 필드 채우기(`fillFromBody`, §5.6)에 쓴다.
 * 코드·수식·이미지·지시자 문법은 버리고 링크·지시자의 라벨만 남긴다.
 */
export function toPlainText(mdx: string): string {
	return (
		mdx
			// 코드 펜스·블록 수식·주석
			.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, " ")
			.replace(/^\$\$[\s\S]*?^\$\$/gm, " ")
			.replace(/\{\/\*[\s\S]*?\*\/\}|<!--[\s\S]*?-->/g, " ")
			// 컨테이너 지시자 펜스와 리프 지시자(`::image{...}`)
			.replace(/^:{3,}[^\n]*$/gm, " ")
			.replace(/^::[a-z][\w-]*(\[[^\]]*\])?(\{[^}]*\})?\s*$/gm, " ")
			// 텍스트 지시자 `:name[라벨]{...}` → 라벨
			.replace(/:[a-z][\w-]*\[([^\]]*)\](\{[^}]*\})?/g, "$1")
			// 이미지는 버리고 링크는 라벨만
			.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
			.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
			// JSX·HTML 태그
			.replace(/<\/?[A-Za-z][^>]*>/g, " ")
			// 제목·인용·목록 표시와 강조 기호
			.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, "")
			.replace(/(\*\*|__|~~|\*|_|`)/g, "")
			.replace(/^\|?[\s:|-]+\|?$/gm, " ")
			.replace(/\|/g, " ")
			.replace(/\s+/g, " ")
			.trim()
	);
}

/**
 * 본문 앞부분의 일반 글자(최대 `maxLength`자, 넘으면 끝에 `…`). 비어 있는 필드를 본문에서 채울 때(`fillFromBody`) 쓴다.
 * 만들 텍스트가 없으면 빈 문자열이다.
 */
export function bodyExcerpt(mdx: string, maxLength = 160): string {
	const text = toPlainText(mdx);
	const chars = Array.from(text);
	if (chars.length <= maxLength) return text;
	return `${chars
		.slice(0, maxLength - 1)
		.join("")
		.trimEnd()}…`;
}
