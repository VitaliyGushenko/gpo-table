import type { SearchFormRule, SearchFormRules } from './search-form';

import type { SearchItems } from './search-item';

/**
 * Вывод правил перевода формы расширенного поиска в Gridify из описания items.
 *
 * Правило по умолчанию знает сам дескриптор (SearchItem.defaultRule — по типу
 * и условию контрола: диапазоны → dateRange, numberCond → numberCond,
 * условие `_contains` → contains, условие/множественный выбор `_in` → in,
 * остальное → equals). Поверх правила — имя колонки Gridify-проекции
 * (item.field) и особые правила (item.rule: wordSearch / hierarchy /
 * in+expandValue / custom) — описание поля остаётся единственным местом
 * конфигурации.
 */
export function buildSearchFormRules(items: SearchItems<any>): SearchFormRules {
    const rules: SearchFormRules = {};
    for (const [key, item] of Object.entries(items ?? {})) {
        if (!item) {
            continue;
        }
        rules[key] = {
            ...item.defaultRule(),
            ...(item.field ? { field: item.field } : {}),
            ...(item.rule ?? {}),
        } as SearchFormRule;
    }
    return rules;
}
