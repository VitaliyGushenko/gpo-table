import { InjectionToken } from '@angular/core';

/**
 * Действия строки реестра.
 * Страница провайдит реализацию под `GPO_TABLE_ACTIONS`; таблица строит по ней
 * первую колонку с меню действий.
 */
export interface GpoTableActions<TRow = Record<string, unknown>> {
    /**
     * Право на редактирование таблицы: разрешает и редактирование, и удаление.
     * Можно передать boolean или функцию/сигнал для динамических прав.
     */
    readonly isEdit: boolean | (() => boolean);
    onEdit?(row: TRow): void | Promise<void>;
    onRemove?(row: TRow): void | Promise<void>;
}

/** Проверить право на действия; поддерживает boolean и сигнал/функцию */
export function isGpoTableEditAllowed<TRow>(
    actions: GpoTableActions<TRow> | null | undefined,
): boolean {
    if (!actions) {
        return false;
    }
    return typeof actions.isEdit === 'function' ? actions.isEdit() : actions.isEdit;
}

/** Токен сервиса действий; без провайдера колонка действий не рисуется */
export const GPO_TABLE_ACTIONS = new InjectionToken<GpoTableActions>(
    'GPO_TABLE_ACTIONS',
);
