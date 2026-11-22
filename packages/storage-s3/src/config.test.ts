import { expect, it } from "vitest";
import { s3Storage } from "./adapter";
import { resolveS3Config } from "./config";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

function awsEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
	return {
		S3_BUCKET: "my-bucket",
		S3_ACCESS_KEY_ID: "my-key",
		S3_SECRET_ACCESS_KEY: "my-secret",
		S3_PUBLIC_URL: "https://cdn.example.com",
		S3_REGION: "ap-northeast-2",
		...overrides,
	};
}

it("S3-CFG-1 환경 변수만으로 AWS S3 연결 설정을 읽고 공개 주소 끝의 슬래시를 정리한다", () => {
	const config = resolveS3Config({
		env: awsEnv({
			S3_BUCKET: "  my-bucket  ",
			S3_ACCESS_KEY_ID: "  my-key  ",
			S3_SECRET_ACCESS_KEY: "  my-secret  ",
			S3_REGION: "  ap-northeast-2  ",
			S3_PUBLIC_URL: "  https://cdn.example.com///  ",
		}),
	});

	// S3-CFG-1.1
	expect({
		bucket: config.bucket,
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		region: config.region,
	}).toEqual({
		bucket: "my-bucket",
		accessKeyId: "my-key",
		secretAccessKey: "my-secret",
		region: "ap-northeast-2",
	});
	// S3-CFG-1.2
	expect(config.publicUrl).toBe("https://cdn.example.com");
	// S3-CFG-1.3
	expect({
		endpoint: config.endpoint,
		forcePathStyle: config.forcePathStyle,
		ticketSeconds: config.ticketSeconds,
	}).toEqual({
		endpoint: undefined,
		forcePathStyle: false,
		ticketSeconds: 600,
	});
});

it("S3-CFG-2 AWS 외 저장소 주소만 주고 지역을 비워 두면 기본 지역(auto)으로 연결한다", () => {
	const config = resolveS3Config({
		env: awsEnv({
			S3_REGION: undefined,
			S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
		}),
	});

	// S3-CFG-2.1
	expect(config.region).toBe("auto");
	// S3-CFG-2.2
	expect(config.endpoint).toBe("https://account.r2.cloudflarestorage.com");
});

it("S3-CFG-3 코드에서 직접 넘긴 설정이 환경 변수보다 우선한다", () => {
	const config = resolveS3Config({
		env: awsEnv({ S3_FORCE_PATH_STYLE: "true" }),
		bucket: "override-bucket",
		region: "us-east-1",
		publicUrl: "https://media.example.org/",
		forcePathStyle: false,
	});

	// S3-CFG-3.1
	expect({
		bucket: config.bucket,
		region: config.region,
		publicUrl: config.publicUrl,
		forcePathStyle: config.forcePathStyle,
	}).toEqual({
		bucket: "override-bucket",
		region: "us-east-1",
		publicUrl: "https://media.example.org",
		forcePathStyle: false,
	});
});

it("S3-CFG-4 저장소를 만들 때는 환경 변수가 비어 있어도 실패하지 않고 실제 사용 시점에 환경 변수를 한 번만 읽는다", () => {
	const env: Record<string, string | undefined> = {};
	const adapter = s3Storage({ env });

	// S3-CFG-4.1
	expect(typeof adapter.url).toBe("function");
	// S3-CFG-4.2
	expect(() => adapter.url(UUID)).toThrow(
		/S3_BUCKET[\s\S]*S3_ACCESS_KEY_ID[\s\S]*S3_SECRET_ACCESS_KEY[\s\S]*S3_PUBLIC_URL[\s\S]*S3_REGION[\s\S]*S3_ENDPOINT/,
	);

	Object.assign(env, awsEnv());
	// S3-CFG-4.3
	expect(adapter.url(UUID)).toBe(`https://cdn.example.com/${UUID}`);

	env.S3_PUBLIC_URL = "https://changed.example.com";
	// S3-CFG-4.4
	expect(adapter.url(UUID)).toBe(`https://cdn.example.com/${UUID}`);
});

it("S3-CFG-5 환경 변수로 버킷 주소를 경로 방식으로 바꾸는 옵션을 켤 수 있다", () => {
	const fromTrue = resolveS3Config({ env: awsEnv({ S3_FORCE_PATH_STYLE: "true" }) });
	const fromOne = resolveS3Config({ env: awsEnv({ S3_FORCE_PATH_STYLE: "1" }) });

	// S3-CFG-5.1
	expect(fromTrue.forcePathStyle).toBe(true);
	// S3-CFG-5.2
	expect(fromOne.forcePathStyle).toBe(true);
});

it("S3-CFG-6 필수 설정 값이 공백뿐이면 비어 있는 것으로 보고 거절한다", () => {
	// S3-CFG-6.1
	expect(() => resolveS3Config({ env: awsEnv({ S3_BUCKET: "   " }) })).toThrow(/S3_BUCKET/);
});

it("S3-CFG-7 지역과 저장소 주소가 둘 다 없으면 설정을 거절한다", () => {
	// S3-CFG-7.1
	expect(() => resolveS3Config({ env: awsEnv({ S3_REGION: undefined, S3_ENDPOINT: undefined }) })).toThrow(
		/S3_REGION[\s\S]*S3_ENDPOINT/,
	);
});

it("S3-CFG-8 공개 주소가 올바른 HTTP(S) 주소가 아니거나 쿼리·프래그먼트·계정 정보가 들어 있으면 설정을 거절한다", () => {
	const withUserOnly = new URL("https://cdn.example.com");
	withUserOnly.username = "u";
	const withPassOnly = new URL("https://cdn.example.com");
	withPassOnly.password = "p";

	// S3-CFG-8.1
	expect(resolveS3Config({ env: awsEnv({ S3_PUBLIC_URL: "http://localhost:9000/" }) }).publicUrl).toBe(
		"http://localhost:9000",
	);
	// S3-CFG-8.2
	expect(
		[
			() => resolveS3Config({ env: awsEnv({ S3_PUBLIC_URL: "cdn.example.com" }) }),
			() => resolveS3Config({ env: awsEnv({ S3_PUBLIC_URL: "ftp://cdn.example.com" }) }),
		].every((fn) => {
			try {
				fn();
				return false;
			} catch {
				return true;
			}
		}),
	).toBe(true);
	// S3-CFG-8.3
	expect(
		[
			() => resolveS3Config({ env: awsEnv({ S3_PUBLIC_URL: "https://cdn.example.com?a=1" }) }),
			() => resolveS3Config({ env: awsEnv({ S3_PUBLIC_URL: "https://cdn.example.com?" }) }),
		].every((fn) => {
			try {
				fn();
				return false;
			} catch {
				return true;
			}
		}),
	).toBe(true);
	// S3-CFG-8.4
	expect(
		[
			() => resolveS3Config({ env: awsEnv({ S3_PUBLIC_URL: "https://cdn.example.com#top" }) }),
			() => resolveS3Config({ env: awsEnv({ S3_PUBLIC_URL: "https://cdn.example.com#" }) }),
		].every((fn) => {
			try {
				fn();
				return false;
			} catch {
				return true;
			}
		}),
	).toBe(true);
	// S3-CFG-8.5
	expect(
		[
			() => resolveS3Config({ env: awsEnv({ S3_PUBLIC_URL: withUserOnly.href }) }),
			() => resolveS3Config({ env: awsEnv({ S3_PUBLIC_URL: withPassOnly.href }) }),
		].every((fn) => {
			try {
				fn();
				return false;
			} catch {
				return true;
			}
		}),
	).toBe(true);
});

it("S3-CFG-9 업로드 허가 유효 시간이 1초~3600초 범위의 정수가 아니면 설정을 거절한다", () => {
	const env = awsEnv();

	// S3-CFG-9.1
	expect([
		resolveS3Config({ env, ticketSeconds: 1 }).ticketSeconds,
		resolveS3Config({ env, ticketSeconds: 3600 }).ticketSeconds,
	]).toEqual([1, 3600]);
	// S3-CFG-9.2
	expect(() => resolveS3Config({ env, ticketSeconds: 0 })).toThrow(Error);
	// S3-CFG-9.3
	expect(() => resolveS3Config({ env, ticketSeconds: 1.5 })).toThrow(Error);
	// S3-CFG-9.4
	expect(() => resolveS3Config({ env, ticketSeconds: 3601 })).toThrow(Error);
});

it("S3-CFG-10 최대 파일 크기가 1바이트~2,147,483,647바이트 범위의 정수가 아니면 설정을 거절한다", () => {
	const env = awsEnv();

	// S3-CFG-10.1
	expect([
		resolveS3Config({ env, maxSize: 1 }).policy.maxSize,
		resolveS3Config({ env, maxSize: 2_147_483_647 }).policy.maxSize,
	]).toEqual([1, 2_147_483_647]);
	// S3-CFG-10.2
	expect(() => resolveS3Config({ env, maxSize: 0 })).toThrow(Error);
	// S3-CFG-10.3
	expect(() => resolveS3Config({ env, maxSize: 10.5 })).toThrow(Error);
	// S3-CFG-10.4
	expect(() => resolveS3Config({ env, maxSize: 2_147_483_648 })).toThrow(Error);
});

it("S3-CFG-11 허용 파일 형식 목록이 비어 있거나 잘못된 형식 문자열을 포함하면 설정을 거절한다", () => {
	const env = awsEnv();

	// S3-CFG-11.1
	expect(() => resolveS3Config({ env, allowedMimeTypes: [] })).toThrow(Error);
	// S3-CFG-11.2
	expect(() => resolveS3Config({ env, allowedMimeTypes: [""] })).toThrow(Error);
	// S3-CFG-11.3
	expect(
		[
			() => resolveS3Config({ env, allowedMimeTypes: ["image/png; charset=utf-8"] }),
			() => resolveS3Config({ env, allowedMimeTypes: ["bad image/png"] }),
		].every((fn) => {
			try {
				fn();
				return false;
			} catch {
				return true;
			}
		}),
	).toBe(true);
});
