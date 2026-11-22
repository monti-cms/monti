/** `s3Storage`에 넘기는 연결·업로드 정책 옵션. 생략한 연결 값은 환경 변수(`S3_*`)에서 읽는다. */
export interface S3StorageOptions {
	/** 버킷 이름(`S3_BUCKET`). */
	bucket?: string;
	/** 접근 키 ID(`S3_ACCESS_KEY_ID`). */
	accessKeyId?: string;
	/** 비밀 접근 키(`S3_SECRET_ACCESS_KEY`). */
	secretAccessKey?: string;
	/** 공개 버킷 또는 CDN 기준 주소(`S3_PUBLIC_URL`). 파일 읽기 주소는 `<publicUrl>/<key>`다. */
	publicUrl?: string;
	/** AWS 리전(`S3_REGION`). `endpoint`가 있고 생략하면 `"auto"`다. */
	region?: string;
	/** AWS 외 S3 호환 저장소 주소(`S3_ENDPOINT`). */
	endpoint?: string;
	/** 버킷을 호스트 대신 경로에 둘지 여부(`S3_FORCE_PATH_STYLE`). */
	forcePathStyle?: boolean;
	/** 서명된 업로드 주소 유효 시간(초). 기본 `600`, 허용 범위 `1`~`3600`. */
	ticketSeconds?: number;
	/** 허용할 MIME 타입 목록. 생략하면 기본 안전 목록을 사용한다. */
	allowedMimeTypes?: readonly string[];
	/** 최대 업로드 크기(바이트). 기본 10 MiB, 최대 `2_147_483_647`. */
	maxSize?: number;
	/** 환경 변수 조회 대상 객체(기본 `process.env`). */
	env?: Readonly<Record<string, string | undefined>>;
}

/** 업로드 허가 발급 시 적용할 허용 MIME 집합과 최대 바이트 크기. */
export interface UploadPolicy {
	allowedMimeTypes: ReadonlySet<string>;
	maxSize: number;
}

/** 검증과 정규화를 마친 S3 연결·업로드 설정. */
export interface ResolvedS3Config {
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	publicUrl: string;
	region: string;
	endpoint?: string;
	forcePathStyle: boolean;
	ticketSeconds: number;
	policy: UploadPolicy;
}
