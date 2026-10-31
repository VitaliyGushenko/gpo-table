import { Type } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, ValidationErrors, ValidatorFn } from '@angular/forms';

import { Utils } from 'src/app/utility/Utils';

import type { SearchFormRule, SearchFormRuleOverride } from './search-form';

/**
 * Условие поля (Hasura-суффикс вывода фильтра)
 */
export type SearchItemCondition = '_in' | '_contains' | '_starts_with' | '_not' | '_not_in';

/** Пустое значение: null / undefined / '' */
export function isNotEmptyValue(value: unknown): boolean {
    return ![null, undefined, ''].includes(value as never);
}

/**
 * Валидатор диапазонов: «начало ≤ конец».
 * Пустые половины диапазона не валидируются (фильтруют по одной границе).
 */
export const rangeOrderValidator: ValidatorFn = (group): ValidationErrors | null => {
    const { from, to } = (group as { value?: { from?: string | Date; to?: string | Date } })?.value ?? {};
    return from && to && Utils.GetDateZeroLocale(from) > Utils.GetDateZeroLocale(to) ? { range: true } : null;
};

/**
 * Тип поля расширенного поиска
 */
export enum SearchItemType {
    string,
    number,
    numberCond,
    boolean,
    date,
    dateRange,
    dateYearRange,
    timeRange,
    select,
    selectTree,
    multipleSelect,
    multipleTreeSelect,
    ngContent,
    component,
}

/**
 * Карта полей расширенного поиска: ключ фильтра → дескриптор.
 * Дескрипторы — чистая конфигурация без состояния: значения живут
 * только в Reactive Form компонента (см. RestAdvancedSearchComponent).
 */
export type SearchItems<T = any> = { [key in keyof T]?: SearchItem };

/**
 * Словарь {label, value} для item'а расширенного поиска из списка сущностей:
 * ключ подписи (или функция подписи — для составных, вроде `[код] имя`) и ключ значения.
 */
export function toDictionary(
    items: any[] | null | undefined,
    label: string | ((item: any) => string),
    valueKey: string,
): { label: string; value: any }[] {
    return (items ?? []).map((e) => ({
        label: typeof label === 'function' ? label(e) : e?.[label],
        value: e?.[valueKey],
    }));
}

/**
 * Словарь {label, value, code, name} для item'а расширенного поиска из списка
 * сущностей с кодом и наименованием: код и наименование едут в опции раздельно
 * (drawer рисует подпись с жирным кодом), label — склеенный для поиска и тегов.
 */
export function toCodeDictionary(
    items: any[] | null | undefined,
    codeKey: string,
    nameKey: string,
): { label: string; value: any; code: any; name: string }[] {
    return (items ?? []).map((e) => ({
        label: `[${e?.[codeKey]}] ${e?.[nameKey]}`,
        value: e?.[codeKey],
        code: e?.[codeKey],
        name: e?.[nameKey],
    }));
}

/**
 * Мемоизация провайдера словаря: пока ссылка на источник не изменилась,
 * возвращается один и тот же маппнутый массив. Без этого каждый вызов
 * провайдера (каждое открытие drawer'а) создаёт новые массивы, и *ngFor
 * списков опций пересоздаёт тысячи nz-option — открытие «висит» секунды.
 */
export function memoDictionary<TSource>(
    source: () => TSource[] | null | undefined,
    map: (items: TSource[]) => any[],
): () => any[] {
    let lastSource: TSource[] | null | undefined;
    let lastResult: any[] | undefined;
    return () => {
        const current = source();
        if (lastResult === undefined || current !== lastSource) {
            lastSource = current;
            lastResult = map(current ?? []);
        }
        return lastResult;
    };
}

/**
 * Стандартный набор условий числовых полей (суффиксы — Hasura-стиль).
 * «Равно» использует суффикс _eq, а не пустую строку: nz-select считает
 * пустое значение «ничего не выбрано» и не показывает подпись условия.
 * Используется как значение по умолчанию для SearchItemNumberCondition;
 * свои наборы задаются через setNumberConds.
 */
export const NUMBER_CONDS: { label: string; value: string }[] = [
    { label: 'Равно', value: '_eq' },
    { label: 'Не равно', value: '_not' },
    { label: 'Больше', value: '_gt' },
    { label: 'Меньше', value: '_lt' },
];

/**
 * Стандартные суффиксы диапазонов (значение по умолчанию
 * dateCondition у SearchItemRange).
 */
export const DATE_RANGE_COND: { from: string; to: string } = { from: '_gte', to: '_lte' };

/**
 * Привязка deep-link'а: query-параметры маршрута → значение поля.
 * Применяется каркасом страницы (applyQueryParams в search-page.base).
 */
export interface SearchItemQueryParamBinding {
    /**
     * Имена query-параметров-алиасов; побеждает последнее непустое значение
     */
    names: string[];
    /**
     * Половина диапазона (from/to) — когда параметр соответствует одной границе
     */
    part?: 'from' | 'to';
    /**
     * Приведение типа значения query-параметра
     */
    type?: 'number' | 'boolean' | 'array' | 'array-number';
    /**
     * Особое преобразование значения — раскрытие по справочнику прямо в
     * конфиге (дескриптору доступны его справочники)
     * @param raw    сырое значение query-параметра (истина по JS-truthiness)
     * @param params все query-параметры маршрута (для параметров-модификаторов)
     */
    expand?: (raw: unknown, params: Record<string, unknown>) => unknown;
}

/**
 * Базовый дескриптор поля расширенного поиска.
 *
 * Класс владеет всем знанием о представлении поля: переводом контрола в фильтр
 * и обратно (toFilter / patchControl), структурой контрола (createControl),
 * правилом Gridify (defaultRule) и ключами фильтра (filterKeys) — компоненту
 * drawer'а и утилитам остаются только обход полей и вызовы.
 *
 * Перевод в REST-фильтр описывается здесь же: `field` — имя колонки
 * Gridify-проекции, если оно отличается от ключа формы; `rule` — особое
 * правило (поиск по словам, иерархия, раскрытие значений).
 */
export class SearchItem {
    /**
     * Тип поля
     */
    type = SearchItemType.string;

    /**
     * Условие (Hasura-суффикс вывода фильтра)
     */
    condition?: SearchItemCondition;

    /**
     * По умолчанию заблокировать
     */
    initialDisabled = false;

    /**
     * Рисовать поле в drawer'е и читать его значение из формы (getFilter).
     * false — значение управляется снаружи страницы (отчётные контролы,
     * программные фильтры): поле скрыто и в фильтр из формы не попадает
     */
    visible = true;

    /**
     * Список режима перед полем ввода («По полному / По частичному» и т.п.):
     * значение режима не попадает в фильтр, а возвращается отдельно (modes)
     */
    beforeList?: { label: string; value: any }[];

    /**
     * Статичный справочник (пары label/value или узлы дерева)
     */
    dictionary?: any[];

    /**
     * Провайдер справочника (ленивое чтение): вызывается при построении формы
     * и при каждом открытии drawer'а — данные справочников грузятся асинхронно
     */
    dictionaryProvider?: () => any[];

    /**
     * Имя колонки Gridify-проекции (по умолчанию — ключ формы)
     */
    field?: string;

    /**
     * Особое правило перевода формы в Gridify
     */
    rule?: SearchFormRuleOverride;

    /**
     * Излучать (controlChange) при изменении значения поля
     * (кросс-поля страницы, автодополнение)
     */
    watch = false;

    constructor(public label: string) {}

    /**
     * Установить условие.
     * Возвращает тип с зафиксированным условием — SearchFormOf выводит из него
     * суффиксный ключ фильтра; подкласс-специфичные сеттеры (setDictionary,
     * setComponent, setNumberConds) нужно вызывать ДО setCondition.
     */
    setCondition<C extends SearchItemCondition>(condition: C): SearchItem & { condition: C } {
        this.condition = condition;
        return this as unknown as SearchItem & { condition: C };
    }

    /**
     * Скрыть / показать поле в drawer'е (конфиг остаётся статичным по составу)
     */
    setVisible(visible: boolean): this {
        this.visible = visible;
        return this;
    }

    /**
     * Установить список режима перед полем ввода
     */
    setBeforeList(beforeList: this['beforeList']): this {
        this.beforeList = beforeList;
        return this;
    }

    /**
     * Установить начальную блокировку
     */
    setInitialDisabled(disabled: boolean): this {
        this.initialDisabled = disabled;
        return this;
    }

    /**
     * Установить имя колонки Gridify-проекции
     */
    setField(field: string): this {
        this.field = field;
        return this;
    }

    /**
     * Установить особое правило перевода формы в Gridify
     */
    setRule(rule: SearchFormRuleOverride): this {
        this.rule = rule;
        return this;
    }

    /**
     * Поле управляется только `configureRequest` таблицы: в общий маппинг
     * формы в Gridify не попадает. Нужно для полей вроде «На дату» склада,
     * где условие зависит от сессий загрузки.
     */
    setRequestOnly(): this {
        return this.setRule({ kind: 'requestOnly' });
    }

    /**
     * Излучать (controlChange) при изменении значения поля
     */
    watchChange(): this {
        this.watch = true;
        return this;
    }

    /**
     * Форматирование значения фильтра для чипа filter-display. По умолчанию
     * значение ищется в справочнике поля (каркас страницы, filterDisplayValue),
     * поэтому задавать нужно только нестандартные случаи (составные подписи,
     * раскрытие значений)
     */
    displayValue?: (value: any) => string;

    /**
     * Установить форматирование значения фильтра для чипа filter-display
     */
    setDisplayValue(displayValue: (value: any) => string): this {
        this.displayValue = displayValue;
        return this;
    }

    /**
     * Привязки deep-link'ов: query-параметры маршрута → значение поля
     * (применяет каркас страницы, applyQueryParams)
     */
    queryBindings?: SearchItemQueryParamBinding[];

    /**
     * Привязать query-параметр(ы) маршрута к полю (deep-links). Повторный
     * вызов добавляет ещё одну привязку: у диапазона — по границе (part),
     * у поля — несколько параметров-источников (алиасы пишутся в порядке
     * вызова, последний непустой побеждает). Раскрытия по справочникам
     * описываются здесь же — options.expand.
     */
    setQueryParam(name: string | string[], options?: Omit<SearchItemQueryParamBinding, 'names'>): this {
        const binding: SearchItemQueryParamBinding = {
            names: Array.isArray(name) ? name : [name],
            ...(options ?? {}),
        };
        this.queryBindings = [...(this.queryBindings ?? []), binding];
        return this;
    }

    // ===========================================================================
    // Представление поля в фильтре и форме (используется RestAdvancedSearchComponent)
    // ===========================================================================

    /**
     * Ключи фильтра, которые порождает поле (подписи filter-display,
     * обратная сборка формы patchFilter, снятие значений setSearchFormValue)
     */
    filterKeys(key: string): string[] {
        return [`${key}${this.condition ?? ''}`];
    }

    /**
     * Подписи фильтра для filter-display: ключ формы и все суффиксные
     * варианты (filterKeys) → лейбл поля; подклассы уточняют подписи
     * (диапазоны — «(конец)» у верхней границы)
     */
    displayNames(key: string): Record<string, string> {
        const names: Record<string, string> = { [key]: this.label };
        for (const filterKey of this.filterKeys(key)) {
            names[filterKey] = this.label;
        }
        return names;
    }

    /**
     * Значение фильтра для чипа filter-display по ключу фильтра: типы с
     * суффиксными условиями дополняют вывод (числовые условия — префикс
     * «Равно / Больше / …»). Вызывается каркасом страницы (filterDisplayValue)
     * до подстановки подписи из справочника
     */
    formatFilterValue(_key: string, _filterKey: string, value: string): string {
        return value;
    }

    /**
     * Сериализация значения контрола в записи фильтра (getFilter);
     * пустое значение → пустая запись
     */
    toFilter(key: string, value: unknown): Record<string, unknown> {
        return isNotEmptyValue(value) ? { [this.filterKeys(key)[0]]: value } : {};
    }

    /**
     * Записать значение фильтра в контрол(ы) поля (patchFilter)
     * @param key       ключ поля (имя контрола формы)
     * @param filterKey ключ фильтра (с суффиксом)
     * @param group     контрол поля (у групповых типов — FormGroup)
     */
    patchControl(key: string, filterKey: string, value: unknown, group: AbstractControl): void {
        void key;
        void filterKey;
        group.setValue(value);
    }

    /**
     * Контрол формы поля (buildForm)
     */
    createControl(fb: UntypedFormBuilder, disabled: boolean): AbstractControl {
        return fb.control({ value: null, disabled });
    }

    /**
     * Значение контрола для сброса формы (reset): Reactive Forms не запоминает
     * начальные значения — reset() без аргументов затирает и условия, и группы
     */
    defaultValue(): unknown {
        return null;
    }

    /**
     * Правило перевода фильтра в Gridify по умолчанию (buildSearchFormRules):
     * по условию контрола — contains / in, остальное — equals
     */
    defaultRule(): SearchFormRule {
        switch (this.condition) {
            case '_contains':
                return { kind: 'contains' };
            case '_in':
                return { kind: 'in' };
            default:
                return { kind: 'equals' };
        }
    }

    /**
     * Нормализация внешнего значения (дерево, deep-links через
     * setSearchFormValue); множественные поля принимают только массивы
     */
    normalizeInput(value: unknown): unknown {
        return value;
    }
}

/**
 * Выпадающий список / дерево / множественный выбор со справочником.
 * Справочник может быть статичным (dictionary) или ленивым провайдером —
 * вызывается при построении формы и при каждом открытии drawer'а
 * (данные справочников грузятся асинхронно).
 */
export class SearchItemSelect extends SearchItem {
    override type = SearchItemType.select;

    setDictionary(dictionary: this['dictionary']): this {
        this.dictionary = dictionary;
        return this;
    }

    setDictionaryProvider(provider: this['dictionaryProvider']): this {
        this.dictionaryProvider = provider;
        return this;
    }
}

export class SearchItemMultipleSelect extends SearchItemSelect {
    override readonly type = SearchItemType.multipleSelect;

    /**
     * Множественный выбор по умолчанию фильтрует вхождением в список (_in):
     * единое условие для вывода фильтра (getFilter), правила Gridify (in)
     * и подписей filter-display
     */
    override condition = '_in' as const;

    override toFilter(key: string, value: unknown): Record<string, unknown> {
        const values = value as unknown[] | undefined;
        return values?.length ? { [`${key}${this.condition}`]: values } : {};
    }

    override normalizeInput(value: unknown): unknown {
        return Array.isArray(value) || !isNotEmptyValue(value) ? value : [value];
    }
}

/**
 * Множественный выбор иерархических кодов (группы МТР и т.п.): выбранные
 * значения → OR-группа условий «префикс `код.`» (+ точное совпадение при
 * exact, пустая группа при nullValue); фиксирует rule hierarchy поверх
 * механики multiple-select.
 */
export class SearchItemMultipleHierarchySelect extends SearchItemMultipleSelect {
    constructor(label: string, options?: SearchItemHierarchyOptions) {
        super(label);
        this.setRule({ kind: 'hierarchy', ...options });
    }
}

/**
 * Строковое поле с частичным совпадением (_contains). Условие зафиксировано
 * на уровне класса: SearchFormOf выводит ключ `_contains`, defaultRule — contains.
 */
export class SearchItemContains extends SearchItem {
    override condition = '_contains' as const;
}

/**
 * Поиск по словам: строка режется по пробелам, каждое слово — отдельное
 * условие (см. wordSearch в search-form). Режим FULL/PARTIAL берётся из
 * searchModes по ключу поля — значение before-контрола, строка 'full'
 * (setBeforeList) включает полное совпадение; по умолчанию PARTIAL.
 */
export class SearchItemWordSearch extends SearchItem {
    override defaultRule(): SearchFormRule {
        return {
            kind: 'wordSearch',
            mode: (ctx) => (String(ctx.modes?.[ctx.key] ?? '').toLowerCase() === 'full' ? 'FULL' : 'PARTIAL'),
        };
    }
}

/** Настройки иерархического правила */
export interface SearchItemHierarchyOptions {
    /** Спец-значение «не указано» — условие по пустому коду (COALESCE-семантика) */
    nullValue?: string;
    /** Добавить к префиксу `код.` точное совпадение */
    exact?: boolean;
}

/**
 * Иерархический код, строковое поле (ОКП и т.п.): значение — префикс
 * `код` / `код.`; фиксирует rule hierarchy.
 */
export class SearchItemHierarchyCode extends SearchItem {
    constructor(label: string, options?: SearchItemHierarchyOptions) {
        super(label);
        this.setRule({ kind: 'hierarchy', ...options });
    }
}

/** Числовое поле */
export class SearchItemNumber extends SearchItem {
    override readonly type = SearchItemType.number;
}

/** Дата */
export class SearchItemDate extends SearchItem {
    override readonly type = SearchItemType.date;

    /**
     * Режим календаря (nzMode): 'month' — выбор месяца; undefined — обычная дата
     */
    pickerMode?: 'month';

    /**
     * Формат отображения значения (nzFormat); undefined — 'dd.MM.yyyy' каркаса
     */
    pickerFormat?: string;

    /**
     * Запрещённые к выбору даты (nzDisabledDate)
     */
    disabledDate?: (current: Date) => boolean;

    /**
     * Месячный пикер: календарь выбора месяца, формат «MMM y»
     * (пример — поле «На дату» реестра склада)
     */
    setMonthPicker(disabledDate?: (current: Date) => boolean): this {
        this.pickerMode = 'month';
        this.pickerFormat = 'MMM y';
        this.disabledDate = disabledDate;
        return this;
    }
}

export class SearchItemSelectTree extends SearchItem {
    override readonly type = SearchItemType.selectTree;

    setDictionary(dictionary: this['dictionary']): this {
        this.dictionary = dictionary;
        return this;
    }

    setDictionaryProvider(provider: this['dictionaryProvider']): this {
        this.dictionaryProvider = provider;
        return this;
    }
}

export class SearchItemMultipleTreeSelect extends SearchItem {
    override readonly type = SearchItemType.multipleTreeSelect;

    /** Дефолтное условие _in — см. SearchItemMultipleSelect */
    override condition = '_in' as const;

    override toFilter(key: string, value: unknown): Record<string, unknown> {
        const values = value as unknown[] | undefined;
        return values?.length ? { [`${key}${this.condition}`]: values } : {};
    }

    override normalizeInput(value: unknown): unknown {
        return Array.isArray(value) || !isNotEmptyValue(value) ? value : [value];
    }

    setDictionary(dictionary: this['dictionary']): this {
        this.dictionary = dictionary;
        return this;
    }

    setDictionaryProvider(provider: this['dictionaryProvider']): this {
        this.dictionaryProvider = provider;
        return this;
    }
}

/**
 * Числовое поле с выбором условия; по умолчанию — стандартный набор
 * NUMBER_CONDS (равно / не равно / больше / меньше)
 */
export class SearchItemNumberCondition extends SearchItem {
    override readonly type = SearchItemType.numberCond;

    /**
     * Доступные условия (суффиксы — Hasura-стиль)
     */
    numberConds: { label: string; value: string }[] = NUMBER_CONDS;

    setNumberConds(numberConds: this['numberConds']): this {
        this.numberConds = numberConds;
        return this;
    }

    override filterKeys(key: string): string[] {
        // голый ключ — легаси старых сохранённых фильтров (условие «Равно»)
        return [key, ...this.numberConds.map((cond) => `${key}${cond.value}`)];
    }

    override formatFilterValue(key: string, filterKey: string, value: string): string {
        // суффикс ключа — выбранное условие; голый ключ — легаси («Равно»)
        const suffix = filterKey.slice(key.length);
        const cond =
            this.numberConds.find((e) => e.value === suffix) ?? (suffix === '' ? this.numberConds[0] : undefined);
        return cond ? `${cond.label} ${value}` : value;
    }

    override toFilter(key: string, value: unknown): Record<string, unknown> {
        const cond = value as { type?: string; value?: unknown } | undefined;
        return isNotEmptyValue(cond?.value) ? { [`${key}${cond?.type ?? ''}`]: cond?.value } : {};
    }

    override patchControl(key: string, filterKey: string, value: unknown, group: AbstractControl): void {
        // суффикс ключа — выбранное условие; голый ключ — легаси («Равно»)
        const suffix = filterKey.slice(key.length);
        group.patchValue({ type: suffix || (this.numberConds?.[0]?.value ?? ''), value });
    }

    override createControl(fb: UntypedFormBuilder, disabled: boolean): AbstractControl {
        return fb.group({
            type: [{ value: this.numberConds?.[0]?.value ?? '', disabled }],
            value: [{ value: null, disabled }],
        });
    }

    override defaultValue(): unknown {
        return { type: this.numberConds?.[0]?.value ?? '', value: null };
    }

    override defaultRule(): SearchFormRule {
        return { kind: 'numberCond' };
    }
}

/**
 * Базовый класс диапазонов (from/to)
 */
export class SearchItemRange extends SearchItem {
    /**
     * Суффиксы вывода диапазона (по умолчанию DATE_RANGE_COND: _gte/_lte)
     */
    dateCondition: { from: string; to: string } = DATE_RANGE_COND;

    setConditionDate(condition: this['dateCondition']): this {
        this.dateCondition = condition;
        return this;
    }

    override filterKeys(key: string): string[] {
        return [`${key}${this.dateCondition.from}`, `${key}${this.dateCondition.to}`];
    }

    override displayNames(key: string): Record<string, string> {
        const names = super.displayNames(key);
        // верхняя граница — своя подпись чипа («Дата … (конец)»), как в легаси-ключах …_end
        names[`${key}${this.dateCondition.to}`] = `${this.label} (конец)`;
        return names;
    }

    override toFilter(key: string, value: unknown): Record<string, unknown> {
        const range = value as { from?: unknown; to?: unknown } | undefined;
        const filter: Record<string, unknown> = {};
        if (range?.from) {
            filter[`${key}${this.dateCondition.from}`] = this.rangeValue(range.from, false);
        }
        if (range?.to) {
            filter[`${key}${this.dateCondition.to}`] = this.rangeValue(range.to, true);
        }
        return filter;
    }

    override patchControl(key: string, filterKey: string, value: unknown, group: AbstractControl): void {
        group.get(filterKey === `${key}${this.dateCondition.from}` ? 'from' : 'to')?.setValue(value);
    }

    override createControl(fb: UntypedFormBuilder, disabled: boolean): AbstractControl {
        return fb.group(
            {
                from: [{ value: null, disabled }],
                to: [{ value: null, disabled }],
            },
            { validators: rangeOrderValidator },
        );
    }

    override defaultValue(): unknown {
        return { from: null, to: null };
    }

    override defaultRule(): SearchFormRule {
        return { kind: 'dateRange' };
    }

    /**
     * Значение фильтра для границы диапазона (isEnd — верхняя).
     * Выбранная календарная дата сохраняется как есть: контрол и чип
     * filter-display показывают локальную дату, поэтому предварительный сбор
     * «конца дня» в UTC (23:59:59Z) отображался следующим днём и уезжал в
     * запрос со сдвигом на сутки. Границы дня (00:00:00Z / 23:59:59Z)
     * собираются один раз — при переводе в Gridify (toIsoDay в search-form).
     */
    protected rangeValue(value: unknown, _isEnd: boolean): unknown {
        return value;
    }
}

export class SearchItemDateRange extends SearchItemRange {
    override readonly type = SearchItemType.dateRange;
}

export class SearchItemDateYearRange extends SearchItemRange {
    override readonly type = SearchItemType.dateYearRange;

    /** В фильтр уходят годы (числа) — локальный год выбранной даты */
    protected override rangeValue(value: unknown, _isEnd: boolean): unknown {
        return new Date(value as string | Date).getFullYear();
    }
}

export class SearchItemTimeRange extends SearchItemRange {
    override readonly type = SearchItemType.timeRange;

    protected override rangeValue(value: unknown, _isEnd: boolean): unknown {
        return Utils.getStringFormatTime(value as Date);
    }
}

/**
 * Встраиваемый компонент (модалка выбора): значение пишется
 * в контрол формы через выход компонента (outputName)
 */
export class SearchItemComponent extends SearchItem {
    override readonly type = SearchItemType.component;

    component: Type<unknown>;
    input?: any;
    outputName?: string;
    isSetting?: boolean;

    setComponent(setting: { component: Type<unknown>; input?: any; outputName?: string; isSetting?: boolean }): this {
        this.component = setting.component;
        this.input = setting.input;
        this.outputName = setting.outputName;
        this.isSetting = setting.isSetting;
        return this;
    }
}

// ===========================================================================
// Вывод типа плоского фильтра из описания полей (типовой аналог filterKeys)
// ===========================================================================

/** Ключи фильтра, которые порождает поле типа V под ключом формы K */
type SearchFilterKeys<V, K extends string> = V extends SearchItemNumberCondition
    ? K | `${K}_eq` | `${K}_not` | `${K}_gt` | `${K}_lt`
    : V extends SearchItemRange
      ? `${K}_gte` | `${K}_lte`
      : V extends { condition: infer C }
        ? [C] extends [SearchItemCondition]
            ? [C] extends ['_in']
                ? `${K}_in`
                : [C] extends ['_contains']
                  ? `${K}_contains`
                  : [C] extends ['_starts_with']
                    ? `${K}_starts_with`
                    : [C] extends ['_not']
                      ? `${K}_not`
                      : [C] extends ['_not_in']
                        ? `${K}_not_in`
                        : K
            : K
        : K;

/** Значение фильтра для поля типа V */
type SearchFilterValue<V> = V extends SearchItemNumberCondition
    ? number
    : V extends SearchItemDateYearRange
      ? number
      : V extends SearchItemTimeRange
        ? string
        : V extends SearchItemRange
          ? Date
          : V extends SearchItemMultipleSelect | SearchItemMultipleTreeSelect
            ? any[]
            : V extends SearchItemWordSearch | SearchItemHierarchyCode | SearchItemContains
              ? string
              : V extends SearchItemNumber
                ? number
                : V extends SearchItemDate
                  ? Date
                  : any;

/**
 * Плоский тип фильтра, выведенный из описания полей: каждому ключу формы
 * ставится набор ключей фильтра с суффиксами условий. Рукописный интерфейс
 * формы (перечисление ключей с суффиксами) больше не нужен — достаточно
 * описать items, а форму вывести: `type Form = SearchFormOf<ReturnType<typeof buildItems>>`.
 * Редкие условия (`_starts_with` и т.п. через setCondition) выводятся,
 * если условие зафиксировано типом (возврат setCondition).
 */
export type SearchFormOf<TItems> = {
    [K in keyof TItems & string as SearchFilterKeys<NonNullable<TItems[K]>, K>]?: SearchFilterValue<
        NonNullable<TItems[K]>
    >;
};
