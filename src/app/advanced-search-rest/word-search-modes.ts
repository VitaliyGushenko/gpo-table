/** Режимы поиска по словам (before-контрол быстрого поиска) */
export const WORD_SEARCH_MODES = [
    { label: 'По полному', value: 'full' },
    { label: 'По частичному', value: 'partial' },
] as const;

/** Значение режима поиска по словам */
export type WordSearchModeValue = (typeof WORD_SEARCH_MODES)[number]['value'];

/** Соединение слов быстрого поиска: И / Или */
export const SEARCH_CONNECT_OPTIONS = [
    { label: 'И', value: 'AND' },
    { label: 'Или', value: 'OR' },
] as const;

/** Значение соединения слов */
export type SearchConnectValue = (typeof SEARCH_CONNECT_OPTIONS)[number]['value'];
