import type { ComponentPropsWithRef } from "react";

/** 경로 형식 링크를 해석할 때만 쓰는 고정 origin. */
const SITE_PATH_BASE = "https://anchor.invalid";

/**
 * 사이트 상대 경로만 통과시킨다. WHATWG URL 파서는 `\`를 `/`로 보아 `/\evil.example`이 다른 origin이 되므로
 * 고정 origin으로 해석해 같은 origin일 때만 경로로 인정한다(M7-SEC-1 P2).
 */
export function resolveSitePath(value: string): string | null {
	if (!value.startsWith("/")) return null;
	const resolved = new URL(value, SITE_PATH_BASE);
	return resolved.origin === SITE_PATH_BASE ? `${resolved.pathname}${resolved.search}${resolved.hash}` : null;
}

/**
 * 본문 링크. `#`·사이트 상대 경로·http(s)만 링크로 만들고(`javascript:`·`data:`·`//host`는 글자로 남는다),
 * 바깥 링크는 새 창으로 연다(`cms-link-external`).
 */
export function CmsLink({ children, href, className, ...props }: ComponentPropsWithRef<"a">) {
	const h = typeof href === "string" ? href : "";
	const siteHref = h.startsWith("#") ? h : resolveSitePath(h);
	const isExternal = /^https?:\/\//.test(h);
	if (!siteHref && !isExternal) {
		return (
			<a {...props} className={className}>
				{children}
			</a>
		);
	}
	if (siteHref) {
		return (
			<a href={siteHref} {...props} className={className}>
				{children}
			</a>
		);
	}
	return (
		<a
			href={h}
			{...props}
			className={["cms-link-external", className].filter(Boolean).join(" ")}
			target={props.target ?? "_blank"}
			rel={props.rel ?? "noreferrer noopener"}
		>
			{children}
		</a>
	);
}
