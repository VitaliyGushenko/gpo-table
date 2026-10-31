import {
    RegistryColumn,
    RegistryColumnType,
    RegistrySearchField,
    RegistrySearchKind,
    RegistrySearchSettings,
} from './registry-table.types';

/** Вид поиска по умолчанию для типа колонки */
const DEFAULT_KIND: Record<RegistryColumnType, RegistrySearchKind | null> = {
    text: 'contains',
    number: 'numberCondition',
    date: 'dateRange',
    template: null,
};

/** Технические поля, которые не попадают в поиск без явной настройки */
const DEFAULT_EXCLUDED_FIELDS: readonly string[] = ['id'];

/** Параметры построения полей поиска */
export interface RegistrySearchBuildOptions {
    /** Дополнительные поля-исключения (кроме id) */
    readonly excludedFields?: readonly string[];
}

/** Построить поля поиска из колонок: исключения и переопределения — в column.search */
export function buildRegistrySearchFields(
    columns: readonly RegistryColumn[],
    options: RegistrySearchBuildOptions = {},
): RegistrySearchField[] {
    const excluded = new Set([...DEFAULT_EXCLUDED_FIELDS, ...(options.excludedFields ?? [])]);

    return columns.flatMap((column) => {
        if (column.search === false) {
            return [];
        }

        const isExplicit = typeof column.search === 'object';
        // id и другие технические поля не ищем, пока не задан объект явно
        if (!isExplicit && excluded.has(column.field)) {
            return [];
        }

        const settings: RegistrySearchSettings = isExplicit ? column.search : {};
        // Справочник без kind — это select; иначе вид по типу колонки
        const defaultKind = settings.dictionary ? 'select' : DEFAULT_KIND[column.type ?? 'text'];
        const kind = settings.kind ?? defaultKind;
        if (!kind) {
            return [];
        }

        return [
            {
                key: column.field,
                field: settings.field ?? column.field,
                title: settings.title ?? column.title,
                kind,
                ...(settings.dictionary ? { dictionary: settings.dictionary } : {}),
            },
        ];
    });
}
