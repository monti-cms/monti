/** 사이트 주소(`/images/a.png`)를 이 사이트의 절대 주소로. 다른 사이트 주소는 `null`(서버가 남의 주소를 부르지 않는다). */
export function siteImageUrl(src: string, origin: string): URL | null {
	const trimmed = src.trim();
	if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) return null;
	const url = new URL(trimmed, origin);
	return url.origin === new URL(origin).origin ? url : null;
}
