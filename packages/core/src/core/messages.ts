import { defineMessages } from "../i18n/define";

/**
 * Messages carried as `message` by snapshot validation (pre-publish checks). Error `code`s stay the same; the variant within a code is `params.reason`.
 * Sites override them with `admin.messages["cms.core"]` in the config.
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
