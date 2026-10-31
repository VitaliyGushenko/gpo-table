import { InjectionToken } from '@angular/core';

/**
 * Действия строки реестра.
 * Страница провайдит реализацию под `REGISTRY_TABLE_ACTIONS`; таблица строит по ней
 * первую колонку с меню действий.
 */
export interface RegistryTableActions<TRow = Record<string, unknown>> {
    /**
     * Право на редактирование таблицы: разрешает и редактирование, и удаление.
     * Можно передать boolean или функцию/сигнал для динамических прав.
     */
    readonly isEdit: boolean | (() => boolean);
    onEdit?(row: TRow): void | Promise<void>;
    onRemove?(row: TRow): void | Promise<void>;
}

/** Проверить право на действия; поддерживает boolean и сигнал/функцию */
export function isRegistryTableEditAllowed<TRow>(
    actions: RegistryTableActions<TRow> | null | undefined,
): boolean {
    if (!actions) {
        return false;
    }
    return typeof actions.isEdit === 'function' ? actions.isEdit() : actions.isEdit;
}

/** Токен сервиса действий; без провайдера колонка действий не рисуется */
export const REGISTRY_TABLE_ACTIONS = new InjectionToken<RegistryTableActions>(
    'REGISTRY_TABLE_ACTIONS',
);
