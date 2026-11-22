// 공개 출구: 프레임워크 어댑터가 쓰는 핸들러와 그 옵션·오류 본문 타입.
export { createHttpHandler } from "./handler/handler";
export type { CookieOptions, HttpErrorBody, HttpHandler, HttpHandlerOptions, SameSite } from "./protocol/types";
