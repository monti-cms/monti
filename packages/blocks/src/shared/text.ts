/** 사전에 쉼표로 이어 적은 슬래시 메뉴 검색어를 낱말 목록으로 나눈다. */
export const keywordList = (text: string): string[] =>
	text
		.split(",")
		.map((word) => word.trim())
		.filter(Boolean);
