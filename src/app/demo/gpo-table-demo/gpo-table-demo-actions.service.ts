import { Injectable, signal } from '@angular/core';

import { GpoTableActions } from '../../lib/gpo-table/core/gpo-table-actions';

/** Демонстрационные действия строки: пишут сообщение в футер демо-таблицы */
@Injectable()
export class GpoTableDemoActionsService implements GpoTableActions<Record<string, unknown>> {
    /** Право на действия переключается в тулбаре демо */
    readonly isEdit = signal(true);
    /** Последнее действие для заметки под таблицей */
    readonly lastAction = signal('Демонстрационная таблица готова к работе');

    onAdd(): void {
        this.lastAction.set('Добавление записи: форма откроется на странице');
    }

    onEdit(row: Record<string, unknown>): void {
        this.lastAction.set(`Редактирование: ${row['name']}`);
    }

    onRemove(row: Record<string, unknown>): void {
        this.lastAction.set(`Удаление: ${row['name']}`);
    }
}
