import { TemplateRef } from '@angular/core';

/** Как показать значение ячейки */
export type RegistryColumnType = 'text' | 'number' | 'date' | 'template';

/** Значение, которое таблица показывает без шаблона */
export type RegistryValue = string | number | boolean | Date | null | undefined;

/** Сортировка одной колонки */
export interface RegistrySort {
    readonly field: string;
    readonly direction: 'asc' | 'desc';
}

/** Вид поля расширенного поиска */
export type RegistrySearchKind =
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
export interface RegistrySearchOption {
    readonly label: string;
    readonly value: string | number;
}

/** Статичный справочник или ленивый провайдер */
export type RegistrySearchDictionary =
    | readonly RegistrySearchOption[]
    | (() => readonly RegistrySearchOption[]);

/** Настройка одного поля в расширенном поиске */
export interface RegistrySearchSettings {
    /** Вид поля; по умолчанию — по типу колонки */
    readonly kind?: RegistrySearchKind;
    /** Имя колонки Gridify, если отличается от `field` */
    readonly field?: string;
    /** Заголовок в поиске, если отличается от заголовка колонки */
    readonly title?: string;
    /** Справочник для select/multipleSelect */
    readonly dictionary?: RegistrySearchDictionary;
}

/** Поле, построенное из колонки для расширенного поиска */
export interface RegistrySearchField {
    /** Ключ формы поиска (обычно `column.field`) */
    readonly key: string;
    /** Имя колонки Gridify */
    readonly field: string;
    readonly title: string;
    readonly kind: RegistrySearchKind;
    readonly dictionary?: RegistrySearchDictionary;
}

/** Описание колонки: только представление, без состояния фильтра и сортировки */
export interface RegistryColumn<TField extends string = string> {
    /** Заголовок */
    readonly title: string;
    /** Ключ поля строки; он же имя поля в Gridify-запросе */
    readonly field: TField;
    /** Тип ячейки; по умолчанию text */
    readonly type?: RegistryColumnType;
    /** Ширина в любых CSS-единицах; по умолчанию — auto */
    readonly width?: string;
    /** Можно ли сортировать; по умолчанию false */
    readonly isSortable?: boolean;
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
    readonly search?: false | RegistrySearchSettings;
}

/** Запрос страницы: всё, что нужно источнику данных */
export interface RegistryQuery {
    readonly page: number;
    readonly pageSize: number;
    readonly sort: RegistrySort | null;
    /** Итоговая Gridify-строка: базовый filter + searchFilter */
    readonly filter?: string;
}

/** Ответ источника: строки и общее количество */
export interface RegistryPage<TRow> {
    readonly rows: readonly TRow[];
    readonly total: number;
}

/** Плоские агрегаты по умолчанию: счётчики и суммы */
export type RegistryAggregates = Readonly<Record<string, number>>;

/** Источник данных таблицы: REST по умолчанию или своя реализация */
export interface RegistryDataSource<TRow, TAggregates = RegistryAggregates> {
    getPage(query: RegistryQuery): Promise<RegistryPage<TRow>>;
    getAggregates?(query: RegistryQuery): Promise<TAggregates>;
}

/** Контекст шаблонной ячейки */
export interface RegistryCellContext<TRow> {
    readonly $implicit: TRow;
    readonly row: TRow;
    readonly value: RegistryValue;
    readonly column: RegistryColumn;
    readonly index: number;
}

/** Шаблон ячейки; конкретный DTO строки приводит страница */
export type RegistryCellTemplate = TemplateRef<RegistryCellContext<Record<string, unknown>>>;

/** Контекст шаблона футера */
export interface RegistryFooterContext<TAggregates> {
    readonly $implicit: TAggregates | null;
    readonly isLoading: boolean;
    readonly error: string | null;
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
}
