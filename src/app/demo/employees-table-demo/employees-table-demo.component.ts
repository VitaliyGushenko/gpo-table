import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';

import { GpoTableComponent } from '../../lib/gpo-table/components/gpo-table.component';
import { GPO_TABLE_ACTIONS } from '../../lib/gpo-table/core/gpo-table-actions';
import { GPO_TABLE_CONFIG } from '../../lib/gpo-table/core/gpo-table-config';
import { GpoTableAggregatesDirective } from '../../lib/gpo-table/directives/gpo-table-aggregates.directive';
import { GpoTableCellDirective } from '../../lib/gpo-table/directives/gpo-table-cell.directive';
import { EmployeesTableDemoActionsService } from './employees-table-demo-actions.service';
import { EmployeesTableDemoConfigService } from './employees-table-demo.config.service';

/** Демонстрационная таблица сотрудников на данных в памяти */
@Component({
    selector: 'app-employees-table-demo',
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
        EmployeesTableDemoActionsService,
        EmployeesTableDemoConfigService,
        { provide: GPO_TABLE_ACTIONS, useExisting: EmployeesTableDemoActionsService },
        { provide: GPO_TABLE_CONFIG, useExisting: EmployeesTableDemoConfigService },
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
                @if (value === 'active') {
                    <span class="demo-page__badge demo-page__badge--green">Работает</span>
                } @else if (value === 'vacation') {
                    <span class="demo-page__badge demo-page__badge--blue">В отпуске</span>
                } @else {
                    <span class="demo-page__badge demo-page__badge--gray">Уволен</span>
                }
            </ng-template>

            <div gpoTableFooter class="demo-page__note">
                <span>{{ lastAction() }}</span>
                <span>Ширины колонок запоминаются отдельно для этой таблицы.</span>
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
                        Сотрудников:
                        <strong>{{ (aggregates?.['count'] ?? 0) | number: '1.0-0' }}</strong>
                    </span>
                    <span>
                        Фонд оплаты:
                        <strong>{{ (aggregates?.['salary'] ?? 0) | number: '1.0-0' }}</strong>
                        руб.
                    </span>
                }
            </ng-template>
        </gpo-table>
    `,
})
export class EmployeesTableDemoComponent {
    private readonly _actions = inject(EmployeesTableDemoActionsService);
    private readonly _table = viewChild.required(GpoTableComponent);

    readonly lastAction = this._actions.lastAction;

    reload(): void {
        void this._table().reload();
    }

    protected onRowClick(row: Record<string, unknown>): void {
        this.lastAction.set(`Выбран сотрудник: ${row['fullName']}`);
    }
}
