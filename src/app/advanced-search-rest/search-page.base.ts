import { Directive, ViewChild } from '@angular/core';

import { ColumnFiltered, GpoLibService } from 'gpo-lib';

import { SearchFormRules } from './search-form';
import { copyTableForExport } from 'src/app/lib/typed-gridify';
import { FilterItem, buildFilterItems } from 'src/app/components/filter-display/filter-items';
import { Page } from 'src/app/models/table/BaseTable';
import { Order } from 'src/app/models/table/Order';
import { SentryErrorHandler } from 'src/app/utility/Sentry';
import { Utils } from 'src/app/utility/Utils';

import { buildAdvancedSearchDisplayNames } from './search-display-names';
import { isNotEmptyValue, SearchItem, SearchItemQueryParamBinding, SearchItems } from './search-item';
import { buildSearchFormRules } from './search-rules';
import { RestAdvancedSearchComponent, SearchControlChange, SearchEvent } from './rest-advanced-search.component';

export type { SearchControlChange, SearchEvent };

/**
 * Минимальный контракт табличной модели для страницы на AdvancedSearchPageBase.
 */
export interface SearchFormTable<TForm extends object> {
    /** Фильтр таблицы (каноническое хранилище — вывод getFilter компонента поиска) */
    filter: TForm;
    /** Правила перевода формы в Gridify (см. buildSearchFormRules); gql-таблицам не нужен */
    searchRules?: SearchFormRules;
    /** Режимы расширенного поиска (before-контролы): ключ поля → значение режима */
    searchModes?: Record<string, unknown>;
    /** Режим соединения слов быстрого поиска */
    wordsJoin?: 'AND' | 'OR';
    /** Сортировка */
    order?: Order;
    /** Пагинация */
    page: Page;
    /** Загрузка данных (привязывается через bindTableData) */
    getData(table: any): Promise<any>;
    /** Загрузка данных с текущими фильтрами */
    updateTable(): Promise<void>;
    /** Агрегаты реестра (каркас загружает параллельно с таблицей) */
    updateAggregates?(): Promise<void>;
    /** Колонки таблицы (сохранение раскладки) */
    columns?: ColumnFiltered[];
    /** Ключ localStorage раскладки колонок и сортировки */
    localStorageName?: string;
    /** Восстановление сохранённой сортировки из localStorage раскладки */
    loadOrderBy?(name: keyof ColumnFiltered, localStorageName: string): ColumnFiltered | undefined;
}

/**
 * Базовый каркас страницы с расширенным поиском (app-advanced-search-rest):
 * страница описывает поля в конфиге (SearchItems), а drawer, синхронизацию
 * форма ↔ фильтр, подписи filter-display, пульсацию и localStorage-персист
 * ведёт базовый класс.
 *
 * Каркас транспорт-агностичен: вывод компонента (плоский фильтр с суффиксами)
 * для gql-страниц является готовым where, для REST переводится в Gridify
 * по правилам из дескрипторов.
 */
@Directive()
export abstract class AdvancedSearchPageBase<TTable extends SearchFormTable<TForm>, TForm extends object> {
    /**
     * Сервис раскладки колонок lib-gpo-table (для сохранения после загрузок);
     * передаётся страницей в super()
     */
    protected constructor(protected readonly _gpoLibService?: GpoLibService) {}

    /**
     * Описание полей расширенного поиска (устанавливается через setSearchItems)
     */
    advancedSearchItems: SearchItems<TForm>;

    /**
     * Подписи фильтров для filter-display: ключи фильтра → названия (строится из items)
     */
    advancedSearchDisplayNames: Record<string, string> = {};

    /**
     * Невалидный диапазон дат внешнего виджета страницы (не drawer'а)
     */
    invalidDateRange = false;

    @ViewChild(RestAdvancedSearchComponent)
    protected restSearch?: RestAdvancedSearchComponent;

    /**
     * Табличная модель страницы
     */
    protected abstract get table(): TTable;

    /**
     * Новая табличная модель (для клонов export/print)
     */
    protected abstract createTable(): TTable;

    /**
     * Загрузка данных реестра (единая точка: таблица, клоны export/print)
     */
    protected abstract getData(table: TTable): Promise<any>;

    /**
     * Ключ localStorage для фильтра; null — фильтр не сохраняется
     */
    protected get tableFilterStorageKey(): string | null {
        return null;
    }

    /**
     * Установить описание полей расширенного поиска:
     * items + подписи filter-display + правила перевода в Gridify таблицы
     */
    protected setSearchItems(items: SearchItems<TForm>): void {
        this.advancedSearchItems = items;
        this.advancedSearchDisplayNames = buildAdvancedSearchDisplayNames(items);
        this.table.searchRules = buildSearchFormRules(items);
    }

    // ===========================================================================
    // Drawer расширенного поиска
    // ===========================================================================

    /**
     * Открыть drawer расширенного поиска
     */
    openSearch(): void {
        this.restSearch?.open();
    }

    /**
     * Кнопка «Поиск» drawer'а: режимы — в каноничное хранилище таблицы
     * (searchModes), фильтр формы — в фильтр таблицы
     */
    onDrawerSearch(event: SearchEvent<TForm>) {
        this.table.searchModes = event.modes ?? {};
        this.table.filter = this.beforeApplyFormFilter(event.filter ?? ({} as TForm), event.modes ?? {});
        this.changeFilter();
    }

    /**
     * Кнопка «Очистить» drawer'а (форму чистит сам компонент);
     * режимы не трогаются — это предпочтение UI, а не фильтр
     */
    onDrawerClear() {
        this.table.filter = {} as TForm;
        this.changeFilter();
    }

    /**
     * Правка формы перед записью в фильтр таблицы:
     * режимы поиска (modes), подстановка значений из внешних форм
     */
    protected beforeApplyFormFilter(form: TForm, modes: Record<string, unknown>): TForm {
        return form;
    }

    /**
     * Изменение watched-поля формы поиска: кросс-правила страницы
     * (автовыбор, зависимые поля). Значение в форму пишется через
     * restSearch.patchFilter({ key: value }).
     */
    onSearchControlChange(_event: SearchControlChange) {}

    /**
     * Значение в фильтр таблицы (дерево, deep-links, быстрый поиск):
     * ключ фильтра выводится из дескриптора (filterKeys), множественные поля
     * принимают только массивы (normalizeInput), пустое значение снимает
     * все варианты ключа поля
     */
    setSearchFormValue(key: string, value: unknown) {
        const item = this.advancedSearchItems?.[key];
        const formKey = item?.filterKeys(key)?.[0] ?? key;
        const normalized = item ? item.normalizeInput(value) : value;
        const isEmpty = !isNotEmptyValue(normalized) || (Array.isArray(normalized) && !normalized.length);
        if (isEmpty) {
            const keys = new Set([key, formKey, ...(item?.filterKeys(key) ?? [])]);
            if (!item) {
                // ключ без дескриптора: снимаем сам ключ и все его суффиксные варианты
                Object.keys(this.table.filter ?? {})
                    .filter((k) => k === key || k.startsWith(`${key}_`))
                    .forEach((k) => keys.add(k));
            }
            // Новый объект вместо удаления ключей на месте: чипы filter-display
            // (OnPush + ngOnChanges) следят за ссылкой фильтра и при мутации
            // не замечают сброс
            const rest: Record<string, unknown> = {};
            Object.keys(this.table.filter ?? {})
                .filter((k) => !keys.has(k))
                .forEach((k) => (rest[k] = this.table.filter[k]));
            this.table.filter = rest as TForm;
        } else {
            this.table.filter = { ...this.table.filter, [formKey]: normalized };
        }
    }

    /**
     * Значение в фильтр таблицы и в форму drawer'а одним вызовом
     * (дерево, сторонние компоненты): setSearchFormValue + patchFilter;
     * options.disableForm — программная блокировка/разблокировка поля формы.
     * Значение должно соответствовать форме контрола (у диапазонов — from/to)
     */
    setSearchValue(key: string, value: unknown, options?: { disableForm?: boolean }) {
        this.setSearchFormValue(key, value);
        this.restSearch?.patchFilter({ [key]: value });
        if (options?.disableForm !== undefined) {
            this.restSearch?.setDisabled(key, options.disableForm);
        }
    }

    // ===========================================================================
    // Deep-links: query-параметры маршрута по привязкам дескрипторов
    // ===========================================================================

    /**
     * Применить deep-links по декларативным привязкам дескрипторов
     * (item.setQueryParam в конфиге полей): последнее непустое значение
     * алиасов приводится по type (number/array/…) или раскрывается через
     * expand, результат — в setSearchFormValue. Параметры без привязок
     * игнорируются; специфичные раскрытия страницы (деревья, сервисы) —
     * в хуке поверх этого метода.
     * @returns true — применён хотя бы один параметр
     */
    protected applyQueryParams(params: Record<string, unknown>): boolean {
        let applied = false;
        const items = (this.advancedSearchItems ?? {}) as Record<string, SearchItem | undefined>;
        for (const [key, item] of Object.entries(items)) {
            for (const binding of item?.queryBindings ?? []) {
                // семантика старых deep-links: значение отбирается по JS-truthiness
                const raw = binding.names
                    .map((name) => params[name])
                    .filter((value) => !!value)
                    .pop();
                if (raw === undefined) {
                    continue;
                }
                const targetKey = binding.part ? (item.filterKeys(key)[binding.part === 'from' ? 0 : 1] ?? key) : key;
                this.setSearchFormValue(targetKey, this.readQueryParam(binding, raw, params));
                applied = true;
            }
        }
        return applied;
    }

    /**
     * Значение привязки: приведение типа или особое раскрытие (expand)
     */
    private readQueryParam(
        binding: SearchItemQueryParamBinding,
        raw: unknown,
        params: Record<string, unknown>,
    ): unknown {
        if (binding.expand) {
            return binding.expand(raw, params);
        }
        switch (binding.type) {
            case 'number':
                return Number(raw);
            case 'boolean':
                return String(raw).toLowerCase() === 'true';
            case 'array':
                return Array.isArray(raw) ? raw : [raw];
            case 'array-number':
                return (Array.isArray(raw) ? raw : [raw]).map(Number);
            default:
                return raw;
        }
    }

    /**
     * Форматирование значений фильтров для filter-display ([functionUpdate]):
     * displayValue дескриптора → вывод дескриптора по ключу фильтра (префикс
     * «Равно / Больше / …» числовых условий) → подпись из справочника поля
     * (label/value, у деревьев key/title) → сырое значение. Даты форматирует
     * сам filter-display.
     */
    filterDisplayValue = (filterKey: string, value: string): string => {
        const found = this.findFilterItem(filterKey);
        if (!found) {
            return value;
        }
        const { key, item } = found;
        if (item.displayValue) {
            return item.displayValue(value) ?? value;
        }
        const formatted = item.formatFilterValue(key, filterKey, value);
        const dictionary = item.dictionaryProvider?.() ?? item.dictionary;
        const pair = dictionary?.find((e) => String(e?.value ?? e?.key) === String(value));
        return pair?.label ?? pair?.title ?? formatted;
    };

    /**
     * Активные фильтры для шапки выгрузки: те же чипы, что показывает
     * app-filter-display (без ViewChild на компонент)
     */
    get filterItems(): FilterItem[] {
        return buildFilterItems(this.table.filter, this.advancedSearchDisplayNames, this.filterDisplayValue);
    }

    /** Дескриптор и его ключ формы по ключу фильтра (в т.ч. суффиксному — _in/_gte/_eq…) */
    private findFilterItem(filterKey: string): { key: string; item: SearchItem } | undefined {
        const items = (this.advancedSearchItems ?? {}) as Record<string, SearchItem | undefined>;
        for (const [key, item] of Object.entries(items)) {
            if (item?.filterKeys(key)?.includes(filterKey)) {
                return { key, item };
            }
        }
        return undefined;
    }

    // ===========================================================================
    // Применение фильтра и загрузка данных
    // ===========================================================================

    /**
     * Применить фильтр с проверкой валидности диапазона
     */
    changeFilter(event?: unknown) {
        if (typeof event === 'boolean') {
            this.invalidDateRange = event;
        }
        if (this.invalidDateRange) {
            return;
        }
        void this.applyFilter();
    }

    /**
     * Ядро перезагрузки реестра: сброс страницы, персист фильтра,
     * пульсация, загрузка данных (страница расширяет агрегатами в updateData)
     */
    async applyFilter() {
        try {
            this.table.page.resetPage();
            this.beforeApplyFilter();
            this.saveTableFilter();
            await this.updateData();
        } catch (error) {
            this.onDataError(error);
        }
    }

    /**
     * Хук перед загрузкой: синхронизация производных состояний страницы
     */
    protected beforeApplyFilter(): void {}

    /**
     * Загрузка данных реестра: таблица + опциональные агрегаты модели
     * (updateAggregates); страница расширяет переопределением
     */
    protected async updateData(): Promise<void> {
        await Promise.all([this.table.updateTable(), this.table.updateAggregates?.()]);
    }

    /**
     * Ошибка загрузки реестра
     */
    protected onDataError(error: unknown): void {
        console.error(error);
    }

    /**
     * Привязать загрузку данных таблицы к getData страницы (один раз вместо ручных bind)
     */
    protected bindTableData(): void {
        this.table.getData = (table: TTable) => this.getData(table);
    }

    // ===========================================================================
    // Инициализация табличной модели
    // ===========================================================================

    /**
     * Универсальная инициализация табличной модели — вызов из ngAfterViewInit
     * до bindTableData: восстановление сортировки из localStorage раскладки
     * колонок и сохранение раскладки после каждой загрузки данных.
     * GpoLibService страница передаёт в super().
     */
    protected initTable(): void {
        const sortColumn = this.table.loadOrderBy?.('sortOrder', this.table.localStorageName);
        if (sortColumn?.sortOrder) {
            this.table.order = new Order(
                sortColumn.columnKey,
                Utils.SortDirectionTypeToOrderByDir(sortColumn.sortOrder === 'ascend' ? 'asc' : 'desc'),
            );
        }

        if (this.table.localStorageName && this.canPersistColumns() && this._gpoLibService) {
            this.table.updateTable = Utils.decoratorAsyncFunc(this.table.updateTable, this.table, () =>
                this._gpoLibService.saveColumns(this.table.localStorageName, this.table.columns),
            ) as TTable['updateTable'];
        }
    }

    /**
     * Разрешено ли сохранять раскладку колонок (страница может отключить
     * для спец-режимов — аналог canPersistTableFilter)
     */
    protected canPersistColumns(): boolean {
        return true;
    }

    /**
     * Клон таблицы для полной выгрузки (экспорт/печать): те же фильтры, режимы
     * и сортировка, страница 1 размером в totalRows
     */
    protected createExportTable(totalRows: number): TTable {
        const table = this.createTable();
        copyTableForExport(this.table, table, totalRows);
        table.getData = (t: TTable) => this.getData(t);
        return table;
    }

    // ===========================================================================
    // Персист фильтра
    // ===========================================================================

    /**
     * Разрешено ли сохранять фильтр (страница может отключить для спец-режимов)
     */
    protected canPersistTableFilter(): boolean {
        return true;
    }

    /**
     * Сохранить фильтр в localStorage
     */
    protected saveTableFilter() {
        const key = this.tableFilterStorageKey;
        if (!key || !this.canPersistTableFilter()) {
            return;
        }
        try {
            localStorage.setItem(key, JSON.stringify(this.table.filter));
        } catch (error) {
            SentryErrorHandler.sendSentryMessage(error);
        }
    }

    /**
     * Загрузить фильтр из localStorage; true — фильтр восстановлен
     */
    protected loadTableFilter(): boolean {
        const key = this.tableFilterStorageKey;
        if (!key) {
            return false;
        }
        try {
            const tableFilterString = localStorage.getItem(key);
            if (!tableFilterString) {
                return false;
            }
            const stored = JSON.parse(tableFilterString) as unknown;
            if (!stored || typeof stored !== 'object') {
                return false;
            }
            this.table.filter = stored as TForm;
            return true;
        } catch (error) {
            SentryErrorHandler.sendSentryMessage(error);
            return false;
        }
    }
}
