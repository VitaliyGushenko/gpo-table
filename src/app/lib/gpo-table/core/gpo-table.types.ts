import { TemplateRef } from '@angular/core';

/** Как показать значение ячейки */
export type GpoTableColumnType = 'text' | 'number' | 'date' | 'template';

/** Значение, которое таблица показывает без шаблона */
export type GpoTableValue = string | number | boolean | Date | null | undefined;

/** Минимальная ширина колонки при изменении размера */
export const GPO_TABLE_COLUMN_MIN_WIDTH = 60;

/**
 * Курсор изменения ширины: системный col-resize на светлой шапке малозаметен,
 * поэтому рисуем контрастную синюю стрелку с белой обводкой.
 */
export const GPO_TABLE_RESIZE_CURSOR =
    'url("data:image/svg+xml,%3Csvg%20xmlns=\'http://www.w3.org/2000/svg\'%20width=\'16\'%20height=\'16\'%20viewBox=\'0%200%2016%2016\'%3E%3Cpath%20d=\'M2%208%207%204v8z\'%20fill=\'%23fff\'%20stroke=\'%23fff\'%20stroke-width=\'2\'%20stroke-linejoin=\'round\'/%3E%3Cpath%20d=\'M14%208%209%204v8z\'%20fill=\'%23fff\'%20stroke=\'%23fff\'%20stroke-width=\'2\'%20stroke-linejoin=\'round\'/%3E%3Cpath%20d=\'M2%208%207%204v8z\'%20fill=\'%231677ff\'/%3E%3Cpath%20d=\'M14%208%209%204v8z\'%20fill=\'%231677ff\'/%3E%3C/svg%3E") 8 8, col-resize';

/** Ширины колонок, сохранённые по полю строки */
export type GpoTableColumnWidths = Readonly<Record<string, number>>;

/** Сортировка одной колонки */
export interface GpoTableSort {
    readonly field: string;
    readonly direction: 'asc' | 'desc';
}

/** Изменение ширины колонки */
export interface GpoTableColumnResize {
    readonly field: string;
    readonly width: number;
}

/** Вид поля расширенного поиска */
export type GpoTableSearchKind =
    | 'contains'
    | 'equals'
    | 'word'
    | 'number'
    | 'numberCondition'
    | 'date'
    | 'dateRange'
    | 'select'
    | 'multipleSelect';

/** Опция справочника для select/multipleSelect */
export interface GpoTableSearchOption {
    readonly label: string;
    readonly value: string | number;
}

/** Статичный справочник или ленивый провайдер */
export type GpoTableSearchDictionary =
    | readonly GpoTableSearchOption[]
    | (() => readonly GpoTableSearchOption[]);

/** Настройка одного поля в расширенном поиске */
export interface GpoTableSearchSettings {
    /** Вид поля; по умолчанию — по типу колонки */
    readonly kind?: GpoTableSearchKind;
    /** Имя колонки Gridify, если отличается от `field` */
    readonly field?: string;
    /** Заголовок в поиске, если отличается от заголовка колонки */
    readonly title?: string;
    /** Справочник для select/multipleSelect */
    readonly dictionary?: GpoTableSearchDictionary;
}

/** Поле, построенное из колонки для расширенного поиска */
export interface GpoTableSearchField {
    /** Ключ формы поиска (обычно `column.field`) */
    readonly key: string;
    /** Имя колонки Gridify */
    readonly field: string;
    readonly title: string;
    readonly kind: GpoTableSearchKind;
    readonly dictionary?: GpoTableSearchDictionary;
}

/** Описание колонки: только представление, без состояния фильтра и сортировки */
export interface GpoTableColumn<TField extends string = string> {
    /** Заголовок */
    readonly title: string;
    /** Ключ поля строки; он же имя поля в Gridify-запросе */
    readonly field: TField;
    /** Тип ячейки; по умолчанию text */
    readonly type?: GpoTableColumnType;
    /** Ширина в любых CSS-единицах; по умолчанию — auto, но в минимальной ширине таблицы учитывается как 120px */
    readonly width?: string;
    /** Можно ли сортировать; по умолчанию false */
    readonly isSortable?: boolean;
    /** Можно ли менять ширину; по умолчанию true */
    readonly isResizable?: boolean;
    /** Показывать ли колонку; по умолчанию true */
    readonly isVisible?: boolean;
    /** Выравнивание; по умолчанию left, для number — right */
    readonly align?: 'left' | 'center' | 'right';
    /** Формат даты Angular; по умолчанию dd.MM.yyyy */
    readonly dateFormat?: string;
    /** Сколько знаков после запятой показывать; если не задано — до 2 без лишних нулей */
    readonly numberDigits?: number;
    /** Дополнительный CSS-класс ячейки */
    readonly cssClass?: string;
    /**
     * Настройка поля в расширенном поиске.
     * false — не искать по колонке; объект — переопределить вид/поле/заголовок/справочник.
     * Не задано — автоматически по типу колонки (кроме template и id).
     */
    readonly search?: false | GpoTableSearchSettings;
}

/** Запрос страницы: всё, что нужно источнику данных */
export interface GpoTableQuery {
    readonly page: number;
    readonly pageSize: number;
    readonly sort: GpoTableSort | null;
    /** Итоговая Gridify-строка: базовый filter + searchFilter */
    readonly filter?: string;
}

/** Ответ источника: строки и общее количество */
export interface GpoTablePage<TRow> {
    readonly rows: readonly TRow[];
    readonly total: number;
}

/** Плоские агрегаты по умолчанию: счётчики и суммы */
export type GpoTableAggregates = Readonly<Record<string, number>>;

/** Источник данных таблицы: REST по умолчанию или своя реализация */
export interface GpoTableDataSource<TRow, TAggregates = GpoTableAggregates> {
    getPage(query: GpoTableQuery): Promise<GpoTablePage<TRow>>;
    getAggregates?(query: GpoTableQuery): Promise<TAggregates>;
}

/** Контекст шаблонной ячейки */
export interface GpoTableCellContext<TRow> {
    readonly $implicit: TRow;
    readonly row: TRow;
    readonly value: GpoTableValue;
    readonly column: GpoTableColumn;
    readonly index: number;
}

/** Шаблон ячейки; конкретный DTO строки приводит страница */
export type GpoTableCellTemplate = TemplateRef<GpoTableCellContext<Record<string, unknown>>>;

/** Контекст шаблона футера */
export interface GpoTableFooterContext<TAggregates> {
    readonly $implicit: TAggregates | null;
    readonly isLoading: boolean;
    readonly error: string | null;
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
}
