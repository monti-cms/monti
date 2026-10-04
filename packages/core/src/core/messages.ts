import { defineMessages } from "../i18n/define";

/**
 * 스냅샷 검사(발행 전 검사)가 `message`로 싣는 문구(M15). 오류 `code`는 그대로이고, 같은 코드 안의 갈래는 `params.reason`이다.
 * 사이트는 설정의 `admin.messages["cms.core"]`로 덮어쓴다.
 */
export const coreMessages = defineMessages("cms.core", {
	en: {
		"table.invalid_colspan": "Invalid colspan value: {value}",
		"table.invalid_rowspan": "Invalid rowspan value: {value}",
		"table.rowspan_overflow": "A cell's rowspan ({rowspan}) exceeds the table's total rows ({rows}).",
		"table.span_too_large": "The cell span exceeds the table's allowed size ({max} columns x {max} rows).",
		"table.span_overlap": "Merged areas of table cells overlap.",
		"table.ragged_rows": "Rows of the table have different column counts, or there are empty cells.",
		untranslatedCount: ({ count }) => (Number(count) === 1 ? "1 place" : `${count} places`),
	},
	ko: {
		"table.invalid_colspan": "잘못된 colspan 값입니다: {value}",
		"table.invalid_rowspan": "잘못된 rowspan 값입니다: {value}",
		"table.rowspan_overflow": "셀의 rowspan({rowspan})이 표의 전체 행 수({rows})를 초과합니다.",
		"table.span_too_large": "셀 병합 범위가 표의 허용 크기({max}열·{max}행)를 넘습니다.",
		"table.span_overlap": "표 셀의 병합 영역이 겹칩니다.",
		"table.ragged_rows": "표의 행마다 열 수가 일치하지 않거나 빈 칸이 있습니다.",
		untranslatedCount: "{count}곳",
	},
});
