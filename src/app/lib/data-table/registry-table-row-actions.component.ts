import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';

import { REGISTRY_TABLE_ACTIONS } from './registry-table-actions';

/** Меню действий строки: «Редактировать» и «Удалить» из сервиса страницы */
@Component({
    selector: 'app-registry-table-row-actions',
    standalone: true,
    imports: [NzButtonModule, NzDropDownModule, NzMenuModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (canEdit() || canRemove()) {
            <button
                type="button"
                nz-button
                nzType="text"
                nzSize="small"
                nz-dropdown
                nzTrigger="click"
                nzPlacement="bottomLeft"
                [nzDropdownMenu]="menu"
                class="registry-table__actions-button"
                aria-label="Действия"
                title="Действия"
                (click)="$event.stopPropagation()">
                ⋯
            </button>

            <nz-dropdown-menu #menu="nzDropdownMenu">
                <ul nz-menu>
                    @if (canEdit()) {
                        <li nz-menu-item (click)="onEdit()">Редактировать</li>
                    }
                    @if (canRemove()) {
                        <li nz-menu-item nzDanger (click)="onRemove()">Удалить</li>
                    }
                </ul>
            </nz-dropdown-menu>
        }
    `,
    styles: [
        `
            :host {
                display: inline-flex;
            }

            .registry-table__actions-button {
                font-size: 18px;
                line-height: 1;
            }
        `,
    ],
})
export class RegistryTableRowActionsComponent {
    readonly row = input.required<Record<string, unknown>>();

    private readonly _actions = inject(REGISTRY_TABLE_ACTIONS, { optional: true });

    protected readonly canEdit = computed(
        () => this._actions?.isEdit === true && !!this._actions.onEdit,
    );
    protected readonly canRemove = computed(
        () => this._actions?.isEdit === true && !!this._actions.onRemove,
    );

    protected onEdit(): void {
        void this._actions?.onEdit?.(this.row());
    }

    protected onRemove(): void {
        void this._actions?.onRemove?.(this.row());
    }
}
