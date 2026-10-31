import { ConditionalOperator } from 'gridify-client';

import { GridifyCondition, TypedGridifyBuilder, normalizeFilterValue } from 'src/app/lib/typed-gridify';

/**
 * Универсальный маппер «форма расширенного поиска → Gridify-фильтр».
 *
 * Форма расширенного поиска (getFilter RestAdvancedSearchComponent) — плоский
 * объект `ключ + Hasura-суффикс` (`_contains/_in/_gte/_lte/_not/_gt/_lt`).
 * Для gql такой объект сам является `where`; для REST его нужно перевести
 * в Gridify-строку — это и делает applySearchForm по декларативным правилам.
 *
 * Правила выводятся из описания items (см. buildSearchFormRules), а особые
 * паттерны описываются переопределениями на дескрипторах:
 * поиск по словам, иерархические коды, раскрытие значений и т.д.
 */

/** Режим поиска по словам в wordSearch-правиле */
export type WordSearchMode = 'FULL' | 'PARTIAL';

/** Соединение верхнего уровня: условия всегда AND, OR — внутри групп (OR-режим меняет только wordSearch) */
export type SearchFormConnect = 'AND' | 'OR';

/** Опции применения формы */
export interface SearchFormOptions {
    /** Режим соединения для правил поиска по словам (по умолчанию AND) */
    connect?: SearchFormConnect;
    /** Режимы (before-контролы): ключ поля → значение режима */
    modes?: Record<string, unknown>;
}

/** Контекст правила режима поиска по словам */
export interface SearchFormModeContext {
    /** Форма (плоский объект с суффиксами) */
    form: Record<string, unknown>;
    /** Режимы (before-контролы): ключ поля → значение режима */
    modes: Record<string, unknown>;
    /** Ключ поля, к которому применяется правило */
    key: string;
}

interface SearchFormFieldRuleBase {
    /** Имя колонки Gridify-проекции (по умолчанию — ключ формы) */
    field?: string;
}

/** Точное равенство (ключ формы без суффикса) */
export interface SearchFormEqualsRule extends SearchFormFieldRuleBase {
    kind?: 'equals';
}

/** Частичное совпадение (ключ + `_contains`) */
export interface SearchFormContainsRule extends SearchFormFieldRuleBase {
    kind: 'contains';
}

/** Числовое условие с суффиксами `'' / _not / _gt / _lt` (контрол numberCond) */
export interface SearchFormNumberCondRule extends SearchFormFieldRuleBase {
    kind: 'numberCond';
}

/**
 * Диапазон (`ключ_gte / ключ_lte`): начало дня / конец дня в ISO
 * (семантика Utils.GetDateZeroSeconds / GetDateLastSeconds).
 * Числовые значения (например годы из dateYearRange) уходят как есть.
 */
export interface SearchFormDateRangeRule extends SearchFormFieldRuleBase {
    kind: 'dateRange';
}

/**
 * Вхождение в список (`ключ_in`) — OR-группа равенств.
 * `expandValue` раскрывает каждое выбранное значение в ОТДЕЛЬНУЮ OR-группу
 * (например docNum: 3 → [3, 5]); без него все значения попадают в одну группу.
 */
export interface SearchFormInRule extends SearchFormFieldRuleBase {
    kind: 'in';
    expandValue?: (value: string | number | boolean) => Array<string | number | boolean>;
}

/**
 * Поиск по словам: строка режется по пробелам, каждое слово — условие `=*`.
 * `mode` возвращает режим: 'FULL' — для слова OR-группа из паттернов целого
 * слова (`слово *`, `* слово *`, `* слово`, `=слово`; пробелы-границы
 * экранируются); 'PARTIAL' — подстрока. Режим читается из контекста
 * (modes — before-контролы drawer'а/quick-поиска).
 */
export interface SearchFormWordSearchRule extends SearchFormFieldRuleBase {
    kind: 'wordSearch';
    mode?: (ctx: SearchFormModeContext) => WordSearchMode;
}

/**
 * Иерархический код (mtrGroup, okpCode): массив значений → OR-группа
 * «префикс `значение.`» (+ точное совпадение при `exact`); одиночная строка —
 * просто префикс без точки. `nullValue` — спец-значение «не указано»
 * (условие по пустой строке, как COALESCE(code, '0') = '0').
 */
export interface SearchFormHierarchyRule extends SearchFormFieldRuleBase {
    kind: 'hierarchy';
    nullValue?: string;
    exact?: boolean;
}

/**
 * Поле, которое не переводится в Gridify здесь: его условие добавляет
 * таблица в configureRequest (например, «На дату» склада)
 */
export interface SearchFormRequestOnlyRule {
    kind: 'requestOnly';
}

/** Произвольное правило страницы */
export interface SearchFormCustomRule {
    kind: 'custom';
    apply: (ctx: SearchFormRuleContext) => void;
}

export type SearchFormRule =
    | SearchFormEqualsRule
    | SearchFormContainsRule
    | SearchFormNumberCondRule
    | SearchFormDateRangeRule
    | SearchFormInRule
    | SearchFormWordSearchRule
    | SearchFormHierarchyRule
    | SearchFormRequestOnlyRule
    | SearchFormCustomRule;

/** Переопределение правила для ключа формы: любой набор полей поверх выведенного правила */
export interface SearchFormRuleOverride {
    kind?: SearchFormRule['kind'];
    /** Имя колонки Gridify-проекции */
    field?: string;
    /** in: раскрытие выбранного значения в отдельную OR-группу */
    expandValue?: SearchFormInRule['expandValue'];
    /** wordSearch: режим поиска по словам */
    mode?: SearchFormWordSearchRule['mode'];
    /** hierarchy: спец-значение «не указано» */
    nullValue?: string;
    /** hierarchy: добавить точное совпадение к префиксу */
    exact?: boolean;
    /** custom: произвольное правило */
    apply?: SearchFormCustomRule['apply'];
}

/** Правила перевода формы в Gridify: ключ формы → правило */
export type SearchFormRules = Record<string, SearchFormRule>;

/** Переопределения правил: ключ формы → частичное правило */
export type SearchFormRuleOverrides = Record<string, SearchFormRuleOverride>;

/** Контекст custom-правила */
export interface SearchFormRuleContext {
    builder: TypedGridifyBuilder<any>;
    /** Форма (плоский объект с суффиксами) */
    form: Record<string, unknown>;
    /** Ключ формы */
    key: string;
    /** Имя колонки Gridify-проекции */
    field: string;
    /** AND | OR */
    connect: SearchFormConnect;
    /** Добавить условие верхнего уровня (AND) */
    add: (field: string, operator: ConditionalOperator, value: unknown) => void;
    /** Добавить OR-группу условий */
    addOrGroup: (conditions: GridifyCondition[]) => void;
}

/** Суффикс → оператор Gridify для числовых условий (контрол numberCond).
 *  Голый ключ без суффикса — легаси старых сохранённых фильтров (условие «Равно»). */
const CONDITION_OPERATORS: Array<[suffix: string, operator: ConditionalOperator]> = [
    ['_eq', ConditionalOperator.Equal],
    ['', ConditionalOperator.Equal],
    ['_not', ConditionalOperator.NotEqual],
    ['_gt', ConditionalOperator.GreaterThan],
    ['_lt', ConditionalOperator.LessThan],
];

/**
 * Безопасное чтение поля формы: null/undefined/'' → undefined.
 */
function readForm(form: Record<string, unknown>, key: string): unknown {
    const value = form[key];
    return value === null || value === undefined || value === '' ? undefined : value;
}

/**
 * Пробел в значении экранируется: парсер Gridify съедает пробелы между оператором
 * и значением, без экранирования ведущий пробел паттерна терялся бы.
 */
function escapeSpaces(value: string): string {
    return value.replace(/ /g, '\\ ');
}

/**
 * Дата из значения формы (Date или строка); некорректное — undefined.
 */
function toDate(value: unknown): Date | undefined {
    if (!value) {
        return undefined;
    }
    const date = value instanceof Date ? value : new Date(String(value));
    return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Начало/конец дня в ISO. Семантика Utils.GetDateZeroSeconds/GetDateLastSeconds
 * (локальные Y/M/D собираются в UTC) продублирована, чтобы lib оставался без UI-импортов.
 */
function toIsoDay(value: unknown, last: boolean): string | undefined {
    const date = toDate(value);
    if (!date) {
        return undefined;
    }
    return new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), last ? 23 : 0, last ? 59 : 0, last ? 59 : 0, 0),
    ).toISOString();
}

/**
 * Перенести форму расширенного поиска в Gridify-строитель по декларативным правилам.
 *
 * @param builder Строитель Gridify-запроса
 * @param form    Плоский объект формы (вывод getFilter RestAdvancedSearchComponent;
 *                для gql-страниц тот же объект является готовым where)
 * @param rules   Правила по ключам формы (см. buildSearchFormRules)
 * @param options Опции (режим AND/OR для поиска по словам)
 */
export function applySearchForm(
    builder: TypedGridifyBuilder<any>,
    form: object | null | undefined,
    rules: SearchFormRules,
    options?: SearchFormOptions,
): void {
    if (!form) {
        return;
    }
    const f = form as Record<string, unknown>;
    const connect: SearchFormConnect = options?.connect ?? 'AND';
    const modes: Record<string, unknown> = options?.modes ?? {};

    let conditionSeen = false;

    const add = (field: string, operator: ConditionalOperator, value: unknown): void => {
        if (normalizeFilterValue(value) === undefined) {
            return;
        }
        builder.addCondition(field, operator, value);
        conditionSeen = true;
    };

    /** OR-группа условий; пустая группа не добавляется */
    const addOrGroup = (conditions: GridifyCondition[]): void => {
        if (!conditions?.length) {
            return;
        }
        builder.orGroup(conditions);
        conditionSeen = true;
    };

    for (const [key, rule] of Object.entries(rules ?? {})) {
        const field = (rule as { field?: string }).field ?? key;
        switch (rule.kind) {
            case 'contains':
                add(field, ConditionalOperator.Contains, readForm(f, `${key}_contains`));
                break;

            case 'numberCond':
                for (const [suffix, operator] of CONDITION_OPERATORS) {
                    add(field, operator, readForm(f, `${key}${suffix}`));
                }
                break;

            case 'dateRange': {
                const from = f[`${key}_gte`];
                if (from !== undefined && from !== null && from !== '') {
                    typeof from === 'number'
                        ? add(field, ConditionalOperator.GreaterThanOrEqual, from)
                        : add(field, ConditionalOperator.GreaterThanOrEqual, toIsoDay(from, false));
                }
                const to = f[`${key}_lte`];
                if (to !== undefined && to !== null && to !== '') {
                    typeof to === 'number'
                        ? add(field, ConditionalOperator.LessThanOrEqual, to)
                        : add(field, ConditionalOperator.LessThanOrEqual, toIsoDay(to, true));
                }
                break;
            }

            case 'in': {
                // голый ключ без суффикса — легаси сохранённых фильтров (до дефолтного _in у multiple-полей)
                const values = readForm(f, `${key}_in`) ?? readForm(f, key);
                if (!Array.isArray(values) || !values.length) {
                    break;
                }
                if (rule.expandValue) {
                    // каждое выбранное значение — своя OR-группа (3 → [3, 5])
                    for (const value of values) {
                        addOrGroup(
                            (rule.expandValue(value as string | number | boolean) ?? []).map((v) => ({
                                field,
                                operator: ConditionalOperator.Equal,
                                value: v,
                            })),
                        );
                    }
                } else {
                    addOrGroup(values.map((v) => ({ field, operator: ConditionalOperator.Equal, value: v })));
                }
                break;
            }

            case 'wordSearch': {
                const raw = readForm(f, key);
                if (typeof raw !== 'string' || !raw.trim()) {
                    break;
                }
                const words = raw.split(' ').filter(Boolean);
                const mode: WordSearchMode = rule.mode?.({ form: f, modes, key }) ?? 'PARTIAL';
                const wordPatterns = (word: string): GridifyCondition[] => [
                    { field, operator: ConditionalOperator.StartsWith, value: escapeSpaces(`${word} `) },
                    { field, operator: ConditionalOperator.Contains, value: escapeSpaces(` ${word} `) },
                    { field, operator: ConditionalOperator.EndsWith, value: escapeSpaces(` ${word}`) },
                    { field, operator: ConditionalOperator.Equal, value: word },
                ];
                if (mode === 'FULL') {
                    connect === 'OR'
                        ? addOrGroup(words.flatMap(wordPatterns))
                        : words.forEach((word) => addOrGroup(wordPatterns(word)));
                } else if (connect === 'OR') {
                    addOrGroup(words.map((word) => ({ field, operator: ConditionalOperator.Contains, value: word })));
                } else {
                    words.forEach((word) => add(field, ConditionalOperator.Contains, word));
                }
                break;
            }

            case 'hierarchy': {
                const rawValue = readForm(f, key) ?? readForm(f, `${key}_in`);
                const values = Array.isArray(rawValue) ? rawValue : rawValue !== undefined ? [rawValue] : [];
                if (!values.length) {
                    break;
                }
                // массив — префикс с точкой, одиночная строка — просто префикс (как в qb-версии)
                const prefixDot = Array.isArray(rawValue);
                const isNull = (v: unknown): boolean => rule.nullValue !== undefined && String(v) === rule.nullValue;
                const conditions: GridifyCondition[] = [];
                if (values.some(isNull)) {
                    conditions.push({ field, operator: ConditionalOperator.Equal, value: '' });
                }
                values.forEach((value) => {
                    if (isNull(value)) {
                        return;
                    }
                    conditions.push({
                        field,
                        operator: ConditionalOperator.StartsWith,
                        value: prefixDot ? `${value}.` : String(value),
                    });
                    if (rule.exact) {
                        conditions.push({ field, operator: ConditionalOperator.Equal, value });
                    }
                });
                addOrGroup(conditions);
                break;
            }

            case 'requestOnly':
                // условие добавляет configureRequest таблицы
                break;

            case 'custom':
                rule.apply({ builder, form: f, key, field, connect, add, addOrGroup });
                break;

            case 'equals':
            case undefined:
            default:
                add(field, ConditionalOperator.Equal, readForm(f, key));
                break;
        }
    }
}
