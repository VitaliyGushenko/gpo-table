import { InjectionToken } from '@angular/core';

import {
    GpoTableAggregates,
    GpoTableColumn,
    GpoTableDataSource,
} from './gpo-table.types';

/** Готовый Gridify-фильтр или функция/сигнал для динамического значения */
export type GpoTableFilterValue = string | (() => string | undefined);

/** Настройки таблицы: страница провайдит сервис под `GPO_TABLE_CONFIG` */
export interface GpoTableConfig<
    TRow extends object = Record<string, unknown>,
    TAggregates = GpoTableAggregates,
> {
    /** Колонки таблицы */
    readonly columns: readonly GpoTableColumn[];
    /** Источник данных: страницы и агрегаты */
    readonly dataSource: GpoTableDataSource<TRow, TAggregates>;
    /** Постоянный Gridify-фильтр страницы */
    readonly filter?: GpoTableFilterValue;
    /** Gridify-фильтр расширенного поиска; склеивается с filter через AND */
    readonly searchFilter?: GpoTableFilterValue;
    /** Размер страницы; по умолчанию — GPO_TABLE_DEFAULT_PAGE_SIZE */
    readonly pageSize?: number;
    /** Варианты размера страницы */
    readonly pageSizeOptions?: readonly number[];
    /** Ключ строки; по умолчанию `id` */
    readonly rowKey?: string;
    /** Ширина для горизонтального скролла; без неё горизонтальный скролл выключен */
    readonly scrollWidth?: string;
    /** Ключ localStorage для ширин колонок; без него ширины живут только в памяти */
    readonly storageKey?: string;
    /** Отступ снизу вне таблицы: padding страницы или внешний футер */
    readonly bottomOffset?: number;
    /** Текст пустого состояния */
    readonly emptyText?: string;
    /** Показывать встроенный футер */
    readonly isShowFooter?: boolean;
}

/** Варианты размера страницы по умолчанию */
export const GPO_TABLE_DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [
    10, 30, 50, 100, 150, 200, 250,
];

/** Токен настроек таблицы; без провайдера таблица не знает колонки и источник данных */
export const GPO_TABLE_CONFIG = new InjectionToken<GpoTableConfig>('GPO_TABLE_CONFIG');

/** Получить значение фильтра: строка или функция/сигнал */
export function resolveGpoTableFilter(
    value: GpoTableFilterValue | undefined,
): string | undefined {
    return typeof value === 'function' ? value() : value;
}
