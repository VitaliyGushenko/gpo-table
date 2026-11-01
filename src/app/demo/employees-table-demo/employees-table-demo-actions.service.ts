import { Injectable, signal } from '@angular/core';

import { GpoTableActions } from '../../lib/gpo-table/core/gpo-table-actions';

/** Демо-действия сотрудников: добавление из шапки таблицы */
@Injectable()
export class EmployeesTableDemoActionsService implements GpoTableActions {
    readonly isEdit = true;
    /** Подпись кнопки добавления настраивается в сервисе */
    readonly addLabel = 'Добавить сотрудника';
    readonly lastAction = signal('Щёлкните строку — событие выбора придёт на страницу.');

    onAdd(): void {
        this.lastAction.set('Добавление сотрудника: форма откроется на странице.');
    }
}
