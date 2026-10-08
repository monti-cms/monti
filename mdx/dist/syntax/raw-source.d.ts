/**
 * Marker a remark plugin sets in `paragraph.data` when the paragraph's only child is source text that must be written back as is
 * (for example an unregistered directive turned back into text). `toDocument` moves such a paragraph into a raw `html` block.
 */
export declare const RAW_SOURCE_PARAGRAPH = "cmsRawSourceParagraph";
