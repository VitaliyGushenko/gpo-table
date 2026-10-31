import { InjectionToken } from '@angular/core';

/**
 * Действия строки реестра.
 * Страница провайдит реализацию под `REGISTRY_TABLE_ACTIONS`; таблица строит по ней
 * первую колонку с меню действий.
 */
export interface RegistryTableActions<TRow = Record<string, unknown>> {
    /** Пользователь уполномочен редактировать таблицу: разрешает редактирование и удаление */
    readonly isEdit: boolean;
    onEdit?(row: TRow): void | Promise<void>;
    onRemove?(row: TRow): void | Promise<void>;
}

/** Токен сервиса действий; без провайдера колонка действий не рисуется */
export const REGISTRY_TABLE_ACTIONS = new InjectionToken<RegistryTableActions>(
    'REGISTRY_TABLE_ACTIONS',
);
