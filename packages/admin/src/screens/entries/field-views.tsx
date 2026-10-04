"use client";

import { type FieldViewProps, useCmsAdminComponents } from "../../admin-components";

/**
 * 보기 필드(`fields.view({ view })`)의 화면. 화면은 관리자 확장이 `fieldViews`로 등록한다.
 * 등록하지 않은 이름이면 아무것도 그리지 않는다.
 */
export function FieldView({ view, ...props }: FieldViewProps & { view: string }) {
	const { fieldViews } = useCmsAdminComponents();
	const View = fieldViews?.[view];
	return View ? <View {...props} /> : null;
}
