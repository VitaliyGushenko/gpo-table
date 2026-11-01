import { Injectable, signal } from '@angular/core';

import { GpoTableActions } from '../../lib/gpo-table/core/gpo-table-actions';

/** Демо-действия заказов: добавление из шапки таблицы */
@Injectable()
export class OrdersTableDemoActionsService implements GpoTableActions {
    readonly isEdit = true;
    /** Подпись кнопки добавления настраивается в сервисе */
    readonly addLabel = 'Создать заказ';
    readonly lastAction = signal('Щёлкните строку — событие выбора придёт на страницу.');

    onAdd(): void {
        this.lastAction.set('Создание заказа: форма откроется на странице.');
    }
}
