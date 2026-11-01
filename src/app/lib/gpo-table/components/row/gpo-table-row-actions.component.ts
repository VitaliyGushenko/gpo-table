import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMenuModule } from 'ng-zorro-antd/menu';

import { GpoTableRowAction, GPO_TABLE_ACTIONS, isGpoTableEditAllowed } from '../../core/gpo-table-actions';

/** Меню действий строки: «Редактировать», «Удалить» и дополнительные пункты из сервиса */
@Component({
    selector: 'gpo-table-row-actions',
    standalone: true,
    imports: [NzButtonModule, NzDropDownModule, NzIconModule, NzMenuModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (hasMenu()) {
            <button
                type="button"
                nz-button
                nzType="text"
                nzSize="small"
                nz-dropdown
                nzTrigger="click"
                nzPlacement="bottomLeft"
                [nzDropdownMenu]="menu"
                class="gpo-table__actions-button"
                aria-label="Действия"
                title="Действия"
                (click)="$event.stopPropagation()">
                ⋯
            </button>

            <nz-dropdown-menu #menu="nzDropdownMenu">
                <ul nz-menu>
                    @if (canEdit()) {
                        <li nz-menu-item (click)="onEdit()">
                            <span nz-icon nzType="edit" class="gpo-table__row-action-icon"></span>
                            Редактировать
                        </li>
                    }

                    @for (action of customActions(); track $index) {
                        <li nz-menu-item (click)="onCustomAction(action)">
                            <span
                                nz-icon
                                [nzType]="action.icon"
                                class="gpo-table__row-action-icon"></span>
                            {{ action.label }}
                        </li>
                    }

                    @if (canRemove()) {
                        <li nz-menu-item (click)="onRemove()">
                            <span
                                nz-icon
                                nzType="delete"
                                class="gpo-table__row-action-icon gpo-table__row-action-icon--danger"></span>
                            Удалить
                        </li>
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

            .gpo-table__actions-button {
                font-size: 18px;
                line-height: 1;
            }

            .gpo-table__row-action-icon {
                margin-inline-end: 8px;
            }

            .gpo-table__row-action-icon--danger {
                color: #ff4d4f;
            }
        `,
    ],
})
export class GpoTableRowActionsComponent {
    readonly row = input.required<Record<string, unknown>>();

    private readonly _actions = inject(GPO_TABLE_ACTIONS, { optional: true });

    protected readonly canEdit = computed(
        () => isGpoTableEditAllowed(this._actions) && !!this._actions?.onEdit,
    );
    protected readonly canRemove = computed(
        () => isGpoTableEditAllowed(this._actions) && !!this._actions?.onRemove,
    );
    protected readonly customActions = computed<readonly GpoTableRowAction[]>(() => {
        if (!isGpoTableEditAllowed(this._actions)) {
            return [];
        }
        return this._actions?.customActions ?? [];
    });
    protected readonly hasMenu = computed(
        () => this.canEdit() || this.canRemove() || this.customActions().length > 0,
    );

    protected onEdit(): void {
        void this._actions?.onEdit?.(this.row());
    }

    protected onCustomAction(action: GpoTableRowAction): void {
        void action.onClick(this.row());
    }

    protected onRemove(): void {
        void this._actions?.onRemove?.(this.row());
    }
}
