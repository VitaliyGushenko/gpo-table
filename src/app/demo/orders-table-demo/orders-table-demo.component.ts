import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';

import { GpoTableComponent } from '../../lib/gpo-table/components/gpo-table.component';
import { GPO_TABLE_ACTIONS } from '../../lib/gpo-table/core/gpo-table-actions';
import { GPO_TABLE_CONFIG } from '../../lib/gpo-table/core/gpo-table-config';
import { GpoTableAggregatesDirective } from '../../lib/gpo-table/directives/gpo-table-aggregates.directive';
import { GpoTableCellDirective } from '../../lib/gpo-table/directives/gpo-table-cell.directive';
import { OrdersTableDemoActionsService } from './orders-table-demo-actions.service';
import { OrdersTableDemoConfigService } from './orders-table-demo.config.service';

/** Демонстрационная таблица заказов на данных в памяти */
@Component({
    selector: 'app-orders-table-demo',
    standalone: true,
    host: { class: 'demo-page' },
    imports: [
        DecimalPipe,
        NzButtonModule,
        GpoTableAggregatesDirective,
        GpoTableCellDirective,
        GpoTableComponent,
    ],
    providers: [
        OrdersTableDemoActionsService,
        OrdersTableDemoConfigService,
        { provide: GPO_TABLE_ACTIONS, useExisting: OrdersTableDemoActionsService },
        { provide: GPO_TABLE_CONFIG, useExisting: OrdersTableDemoConfigService },
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <gpo-table (rowClick)="onRowClick($event)">
            <div gpoTableHeader class="demo-page__header">
                <div class="demo-page__actions">
                    <button nz-button (click)="reload()">Обновить</button>
                </div>
            </div>

            <ng-template gpoTableCell="status" let-value="value">
                @if (value === 'new') {
                    <span class="demo-page__badge demo-page__badge--blue">Новый</span>
                } @else if (value === 'processing') {
                    <span class="demo-page__badge demo-page__badge--orange">В работе</span>
                } @else {
                    <span class="demo-page__badge demo-page__badge--green">Выполнен</span>
                }
            </ng-template>

            <div gpoTableFooter class="demo-page__note">
                <span>{{ lastAction() }}</span>
                <span>Данные в памяти; ширины колонок запоминаются отдельно.</span>
            </div>

            <ng-template
                gpoTableAggregates
                let-aggregates
                let-isLoading="isLoading"
                let-error="error">
                @if (isLoading) {
                    <span>Загрузка итогов…</span>
                } @else if (error) {
                    <span class="demo-page__error">Не удалось загрузить итоги</span>
                } @else {
                    <span>
                        Заказов:
                        <strong>{{ (aggregates?.['count'] ?? 0) | number: '1.0-0' }}</strong>
                    </span>
                    <span>
                        Сумма:
                        <strong>{{ (aggregates?.['total'] ?? 0) | number: '1.2-2' }}</strong>
                        руб.
                    </span>
                }
            </ng-template>
        </gpo-table>
    `,
})
export class OrdersTableDemoComponent {
    private readonly _actions = inject(OrdersTableDemoActionsService);
    private readonly _table = viewChild.required(GpoTableComponent);

    readonly lastAction = this._actions.lastAction;

    reload(): void {
        void this._table().reload();
    }

    protected onRowClick(row: Record<string, unknown>): void {
        this.lastAction.set(`Выбран заказ: ${row['number']}`);
    }
}
