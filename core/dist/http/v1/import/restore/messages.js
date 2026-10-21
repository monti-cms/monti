import { defineMessages } from "../../../../i18n/define.js";
/**
 * The text of what a backup restore tells: the problems that stop it (a key per `RestoreProblemCode`), the warnings (`RestoreWarningCode`), the data it does not
 * bring back (`NotRestoredCode`) and the templates it skips. Sites override the text with `admin.messages["cms.core.restore"]` in the config.
 */
export const restoreMessages = defineMessages("cms.core.restore", {
    en: {
        files_unreadable: "Its files in the backup are missing or could not be read.",
        id_invalid: "Its id is not a valid id.",
        id_repeated: "Its id is used twice in the backup.",
        collection_unknown: ({ collection }) => `This site has no collection called ${collection}.`,
        locale_unknown: ({ locale }) => `The language ${locale} isn't set up on this site.`,
        translation_repeated: ({ locale }) => `Its original entry has two translations in ${locale}.`,
        source_missing: "Its original entry is not in the backup.",
        source_other_collection: "Its original entry is in another collection, or is itself a translation.",
        translation_invalid: "It doesn't follow the rules of a translation on this site.",
        body_invalid: ({ state }) => state === "published"
            ? "Its published body doesn't fit this site's schema."
            : "Its draft doesn't fit this site's schema.",
        published_body_missing: "It is published, but the backup holds no published body for it.",
        publish_invalid: "Its published body can't be published under this site's schema.",
        folder_missing: "Its folder is not in the backup.",
        folder_other_collection: "Its folder belongs to another collection.",
        folder_cycle: "Its folder is inside itself.",
        media_missing: "It uses a media file that is not in the backup.",
        reference_missing: "It links to an entry that is not in the backup.",
        address_repeated: "This address appears twice in the backup.",
        address_entry_missing: "This address belongs to an entry that is not in the backup.",
        address_collection_unknown: ({ collection }) => `This address is in ${collection}, which this site doesn't have.`,
        media_file_missing: "The file is not in this site's storage. The record is restored, but the file has to be uploaded again.",
        files_not_checked: "Media files were not checked. Without storage settings, or when storage can't be reached, a restore can't tell whether the files are there.",
        not_restored_preferences: ({ count }) => count === undefined
            ? "Admin preferences. They belong to users, and a backup does not carry users."
            : `Admin preferences of ${count} ${Number(count) === 1 ? "user" : "users"}. They belong to users, and a backup does not carry users.`,
        not_restored_accounts: "User accounts and sign-in sessions. A backup does not carry them.",
        not_restored_api_keys: "API keys. A backup does not carry them.",
        not_restored_ai_connections: "AI connections. A backup does not carry them.",
        not_restored_event_logs: "Event logs. A restore writes no events, so plugins that subscribe to entry events are not notified.",
        not_restored_plugins: "Data that plugins keep for themselves. A backup does not carry it.",
        template_skipped_id: "A template with this id is already on the site.",
        template_skipped_name: "A template with this name is already on the site.",
    },
    ko: {
        files_unreadable: "백업에서 이 글의 파일이 없거나 읽을 수 없어요.",
        id_invalid: "올바른 id가 아니에요.",
        id_repeated: "백업에서 같은 id를 두 번 써요.",
        collection_unknown: ({ collection }) => `이 사이트에는 ${collection} 컬렉션이 없어요.`,
        locale_unknown: ({ locale }) => `이 사이트에 설정되지 않은 언어(${locale})예요.`,
        translation_repeated: ({ locale }) => `원문 글에 ${locale} 번역이 두 개 있어요.`,
        source_missing: "원문 글이 백업에 없어요.",
        source_other_collection: "원문 글이 다른 컬렉션에 있거나, 원문 글 자체가 번역이에요.",
        translation_invalid: "이 사이트의 번역 규칙에 맞지 않아요.",
        body_invalid: ({ state }) => state === "published" ? "발행본이 이 사이트의 스키마와 맞지 않아요." : "초안이 이 사이트의 스키마와 맞지 않아요.",
        published_body_missing: "발행된 글인데 백업에 발행본이 없어요.",
        publish_invalid: "발행본이 이 사이트의 스키마로는 발행할 수 없어요.",
        folder_missing: "폴더가 백업에 없어요.",
        folder_other_collection: "폴더가 다른 컬렉션 것이에요.",
        folder_cycle: "폴더가 자기 자신 안에 들어 있어요.",
        media_missing: "백업에 없는 미디어 파일을 써요.",
        reference_missing: "백업에 없는 글을 가리켜요.",
        address_repeated: "백업에 이 주소가 두 번 나와요.",
        address_entry_missing: "이 주소의 글이 백업에 없어요.",
        address_collection_unknown: ({ collection }) => `이 주소는 이 사이트에 없는 ${collection} 컬렉션에 있어요.`,
        media_file_missing: "이 사이트의 저장소에 파일이 없어요. 기록은 복원되지만 파일은 다시 올려야 해요.",
        files_not_checked: "미디어 파일은 확인하지 못했어요. 저장소 설정이 없거나 저장소에 연결할 수 없으면 파일이 있는지 알 수 없어요.",
        not_restored_preferences: ({ count }) => count === undefined
            ? "관리자 환경설정이에요. 사용자에게 속한 것이고 백업에는 사용자가 없어요."
            : `사용자 ${count}명의 관리자 환경설정이에요. 사용자에게 속한 것이고 백업에는 사용자가 없어요.`,
        not_restored_accounts: "사용자 계정과 로그인 세션이에요. 백업에는 들어 있지 않아요.",
        not_restored_api_keys: "API 키예요. 백업에는 들어 있지 않아요.",
        not_restored_ai_connections: "AI 연결이에요. 백업에는 들어 있지 않아요.",
        not_restored_event_logs: "이벤트 기록이에요. 복원은 이벤트를 남기지 않아서, 글 이벤트를 구독하는 플러그인에는 알리지 않아요.",
        not_restored_plugins: "플러그인이 따로 보관하는 데이터예요. 백업에는 들어 있지 않아요.",
        template_skipped_id: "같은 id의 템플릿이 이미 사이트에 있어요.",
        template_skipped_name: "같은 이름의 템플릿이 이미 사이트에 있어요.",
    },
});
