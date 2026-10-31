import type { SearchItems } from './search-item';

/**
 * Подписи фильтров для app-filter-display: ключи items плюс все суффиксные
 * варианты, которые поле порождает во фильтре (displayNames дескриптора:
 * у диапазонов верхняя граница — «(конец)», условия numberCond и _in/_contains
 * — лейбл поля; префикс «Равно / Больше / …» числовых условий добавляет
 * каркас страницы в filterDisplayValue).
 */
export function buildAdvancedSearchDisplayNames(items: SearchItems<any>): Record<string, string> {
    const names: Record<string, string> = {};
    for (const [key, item] of Object.entries(items ?? {})) {
        if (!item) {
            continue;
        }
        Object.assign(names, item.displayNames(key));
    }
    return names;
}

/**
 * Подпись узла дерева по ключу (поиск в глубину, включая вложенные узлы).
 * Для displayValue дескрипторов: чипы деревьев организаций/финансирования.
 * Поля узла настраиваются (по умолчанию key/title); не найдено — undefined,
 * вызывающий конфиг подставляет сырое значение.
 */
export function treeNodeDisplayName(
    nodes: any[] | null | undefined,
    value: unknown,
    fields?: { key?: string; title?: string },
): string | undefined {
    const keyField = fields?.key ?? 'key';
    const titleField = fields?.title ?? 'title';
    for (const node of nodes ?? []) {
        if (String(node?.[keyField]) === String(value)) {
            return node?.[titleField];
        }
        const found = treeNodeDisplayName(node?.children, value, fields);
        if (found !== undefined) {
            return found;
        }
    }
    return undefined;
}
