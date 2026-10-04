import { getPluginOptions } from "@monti-cms/core/client";
import { BAREUN_PLUGIN_NAME, type ResolvedBareunOptions, resolveBareunOptions } from "./options";

/** 사이트 설정에 등록한 바른 검사기의 설정. 서버 경로와 관리자 화면이 함께 읽는다. */
export function readBareunOptions(): ResolvedBareunOptions {
	return getPluginOptions<ResolvedBareunOptions>(BAREUN_PLUGIN_NAME) ?? resolveBareunOptions();
}
