import { Injectable, signal } from '@angular/core';

import { RegistryTableActions } from '../registry-table-actions';

/** Демонстрационные действия строки: пишут сообщение в футер демо-таблицы */
@Injectable()
export class RegistryTableDemoActionsService implements RegistryTableActions<Record<string, unknown>> {
    /** Право на действия переключается в тулбаре демо */
    readonly isEdit = signal(true);
    /** Последнее действие для заметки под таблицей */
    readonly lastAction = signal('Демонстрационная таблица готова к работе');

    onEdit(row: Record<string, unknown>): void {
        this.lastAction.set(`Редактирование: ${row['name']}`);
    }

    onRemove(row: Record<string, unknown>): void {
        this.lastAction.set(`Удаление: ${row['name']}`);
    }
}
