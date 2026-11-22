import { expect, it } from "vitest";
import {
	assertSafeKey,
	DEFAULT_ALLOWED_MIME_TYPES,
	DEFAULT_MAX_SIZE,
	dispositionOf,
	normalizeMimeList,
	validateUploadPolicy,
} from "./policy";
import type { UploadPolicy } from "./types";

const DEFAULT_POLICY: UploadPolicy = {
	allowedMimeTypes: normalizeMimeList(DEFAULT_ALLOWED_MIME_TYPES),
	maxSize: DEFAULT_MAX_SIZE,
};

function errorCodeOf(fn: () => unknown): string | null {
	try {
		fn();
		return null;
	} catch (error) {
		return (error as { code?: string }).code ?? null;
	}
}

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

it("S3-POL-1 소문자 UUID 형식의 파일 키는 통과한다", () => {
	// S3-POL-1.1
	expect(() => assertSafeKey(VALID_UUID)).not.toThrow();
});

it("S3-POL-2 UUID 형식이 아닌 파일 키는 사용할 수 없다", () => {
	// S3-POL-2.1
	expect(errorCodeOf(() => assertSafeKey(""))).toBe("BAD_REQUEST");
	// S3-POL-2.2
	expect([errorCodeOf(() => assertSafeKey("../secret")), errorCodeOf(() => assertSafeKey(`../${VALID_UUID}`))]).toEqual(
		["BAD_REQUEST", "BAD_REQUEST"],
	);
	// S3-POL-2.3
	expect([
		errorCodeOf(() => assertSafeKey("dir/file.png")),
		errorCodeOf(() => assertSafeKey(`${VALID_UUID}/extra`)),
	]).toEqual(["BAD_REQUEST", "BAD_REQUEST"]);
	// S3-POL-2.4
	expect(errorCodeOf(() => assertSafeKey("index.html"))).toBe("BAD_REQUEST");
	// S3-POL-2.5
	expect(errorCodeOf(() => assertSafeKey("550E8400-E29B-41D4-A716-446655440000"))).toBe("BAD_REQUEST");
});

it("S3-POL-3 기본 허용 형식과 1바이트~최대 크기(10 MiB) 파일은 올릴 수 있고 형식 이름은 소문자로 통일된다", () => {
	// S3-POL-3.1
	expect([
		validateUploadPolicy({ mime: "IMAGE/PNG", size: 1 }, DEFAULT_POLICY),
		validateUploadPolicy({ mime: "IMAGE/PNG", size: DEFAULT_MAX_SIZE }, DEFAULT_POLICY),
	]).toEqual(["image/png", "image/png"]);
});

it("S3-POL-4 사용자가 직접 정한 허용 형식과 최대 크기가 기본 규칙을 대체하며 대소문자를 구분하지 않는다", () => {
	const customPolicy: UploadPolicy = {
		allowedMimeTypes: normalizeMimeList(["Application/JSON"]),
		maxSize: 2048,
	};

	// S3-POL-4.1
	expect(validateUploadPolicy({ mime: "application/json", size: 2048 }, customPolicy)).toBe("application/json");
	// S3-POL-4.2
	expect(errorCodeOf(() => validateUploadPolicy({ mime: "image/png", size: 100 }, customPolicy))).toBe("BAD_REQUEST");
});

it("S3-POL-5 기본 규칙에서는 스크립트 실행 위험이 있는 SVG와 HTML을 올릴 수 없다", () => {
	// S3-POL-5.1
	expect(errorCodeOf(() => validateUploadPolicy({ mime: "image/svg+xml", size: 100 }, DEFAULT_POLICY))).toBe(
		"BAD_REQUEST",
	);
	// S3-POL-5.2
	expect(errorCodeOf(() => validateUploadPolicy({ mime: "text/html", size: 100 }, DEFAULT_POLICY))).toBe("BAD_REQUEST");
});

it("S3-POL-6 부가 옵션이 붙은 형식 문자열은 올릴 수 없다", () => {
	// S3-POL-6.1
	expect(
		errorCodeOf(() => validateUploadPolicy({ mime: "image/png; charset=utf-8", size: 1024 }, DEFAULT_POLICY)),
	).toBe("BAD_REQUEST");
});

it("S3-POL-7 최대 크기를 넘는 파일은 올릴 수 없다", () => {
	// S3-POL-7.1
	expect(
		errorCodeOf(() => validateUploadPolicy({ mime: "image/png", size: DEFAULT_MAX_SIZE + 1 }, DEFAULT_POLICY)),
	).toBe("BAD_REQUEST");
});

it("S3-POL-8 크기가 0 이하이거나 정수가 아닌 파일은 올릴 수 없다", () => {
	// S3-POL-8.1
	expect(errorCodeOf(() => validateUploadPolicy({ mime: "image/png", size: 0 }, DEFAULT_POLICY))).toBe("BAD_REQUEST");
	// S3-POL-8.2
	expect(errorCodeOf(() => validateUploadPolicy({ mime: "image/png", size: -1 }, DEFAULT_POLICY))).toBe("BAD_REQUEST");
	// S3-POL-8.3
	expect(errorCodeOf(() => validateUploadPolicy({ mime: "image/png", size: 1.5 }, DEFAULT_POLICY))).toBe("BAD_REQUEST");
});

it("S3-POL-9 브라우저에서 바로 보여 줄 이미지와 내려받게 할 파일을 구분한다", () => {
	// S3-POL-9.1
	expect(dispositionOf("image/png")).toBeUndefined();
	// S3-POL-9.2
	expect(dispositionOf("application/pdf")).toBe("attachment");
	// S3-POL-9.3
	expect(dispositionOf("image/svg+xml")).toBe("attachment");
});
