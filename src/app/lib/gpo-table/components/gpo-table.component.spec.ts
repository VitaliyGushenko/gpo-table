import { Component, signal, Type, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { staticGridifyDataSource } from '../adapters/index';
import { GpoTableCellDirective } from '../directives/gpo-table-cell.directive';
import { GPO_TABLE_ACTIONS, GpoTableActions } from '../core/gpo-table-actions';
import { GpoTableComponent } from './gpo-table.component';
import { GpoTableColumn, GpoTableDataSource, GpoTableQuery } from '../core/gpo-table.types';

interface Row {
    id: number;
    name: string;
}

const ROWS: readonly Row[] = [
    { id: 3, name: 'Gamma' },
    { id: 2, name: 'Beta' },
    { id: 1, name: 'Alpha' },
];

@Component({
    standalone: true,
    imports: [GpoTableCellDirective, GpoTableComponent],
    template: `
        <gpo-table [dataSource]="dataSource" [columns]="columns" [pageSize]="2" [storageKey]="'component-test'">
            <ng-template gpoTableCell="name" let-value="value">
                <span class="name-cell">{{ value }}</span>
            </ng-template>
        </gpo-table>
    `,
})
class HostComponent {
    readonly dataSource = staticGridifyDataSource(ROWS);
    readonly columns: GpoTableColumn[] = [
        { title: 'ID', field: 'id', type: 'number', isSortable: true },
        { title: 'Наименование', field: 'name' },
    ];
}

@Component({
    standalone: true,
    imports: [GpoTableComponent],
    template: `<gpo-table [dataSource]="dataSource" [columns]="columns" />`,
})
class ErrorHostComponent {
    private _calls = 0;

    readonly dataSource: GpoTableDataSource<Row> = {
        getPage: async () => {
            this._calls += 1;
            if (this._calls === 1) {
                throw new Error('Нет данных');
            }
            return { rows: [{ id: 1, name: 'Alpha' }], total: 1 };
        },
    };

    readonly columns: GpoTableColumn[] = [{ title: 'Наименование', field: 'name' }];
}

const PAGINATION_ROWS: readonly Row[] = Array.from({ length: 57 }, (_, index) => ({
    id: index + 1,
    name: `Строка ${index + 1}`,
}));

@Component({
    standalone: true,
    imports: [GpoTableComponent],
    template: `<gpo-table [dataSource]="dataSource" [columns]="columns" [pageSize]="10" />`,
})
class PaginationHostComponent {
    readonly dataSource = staticGridifyDataSource(PAGINATION_ROWS);
    readonly columns: GpoTableColumn[] = [{ title: 'ID', field: 'id', type: 'number' }];
    readonly table = viewChild.required(GpoTableComponent);
}

@Component({
    standalone: true,
    imports: [GpoTableComponent],
    template: `
        <gpo-table
            [dataSource]="dataSource"
            [columns]="columns"
            [filter]="baseFilter"
            [searchFilter]="searchFilter" />
    `,
})
class FilterHostComponent {
    readonly queries: GpoTableQuery[] = [];
    readonly columns: GpoTableColumn[] = [{ title: 'Наименование', field: 'name' }];
    readonly baseFilter = 'status=active';
    readonly searchFilter = 'name_contains=тест';
    readonly dataSource: GpoTableDataSource<Row> = {
        getPage: async (query) => {
            this.queries.push(query);
            return { rows: [], total: 0 };
        },
    };
}

const actionSpies = {
    onEdit: jasmine.createSpy('onEdit'),
    onRemove: jasmine.createSpy('onRemove'),
};
const canEditSignal = signal(true);

const customActionSpy = jasmine.createSpy('customAction');
const addSpy = jasmine.createSpy('onAdd');
const addCanEditSignal = signal(true);
const addLabelSignal = signal<string | undefined>('Создать');
const addActions: GpoTableActions = {
    get isEdit(): boolean {
        return addCanEditSignal();
    },
    get addLabel(): string | undefined {
        return addLabelSignal();
    },
    onAdd: addSpy,
};

@Component({
    standalone: true,
    imports: [GpoTableComponent],
    providers: [
        {
            provide: GPO_TABLE_ACTIONS,
            useValue: {
                isEdit: true,
                onEdit: actionSpies.onEdit,
                onRemove: actionSpies.onRemove,
            } satisfies GpoTableActions<Row>,
        },
    ],
    template: `<gpo-table [dataSource]="dataSource" [columns]="columns" />`,
})
class ActionsHostComponent {
    readonly dataSource = staticGridifyDataSource(ROWS);
    readonly columns: GpoTableColumn[] = [{ title: 'Наименование', field: 'name' }];
}

@Component({
    standalone: true,
    imports: [GpoTableComponent],
    providers: [
        {
            provide: GPO_TABLE_ACTIONS,
            useValue: {
                isEdit: false,
                onEdit: actionSpies.onEdit,
                onRemove: actionSpies.onRemove,
            } satisfies GpoTableActions<Row>,
        },
    ],
    template: `<gpo-table [dataSource]="dataSource" [columns]="columns" />`,
})
class ActionsDisabledHostComponent {
    readonly dataSource = staticGridifyDataSource(ROWS);
    readonly columns: GpoTableColumn[] = [{ title: 'Наименование', field: 'name' }];
}

@Component({
    standalone: true,
    imports: [GpoTableComponent],
    providers: [{ provide: GPO_TABLE_ACTIONS, useValue: addActions }],
    template: `<gpo-table [dataSource]="dataSource" [columns]="columns" />`,
})
class AddActionsHostComponent {
    readonly dataSource = staticGridifyDataSource(ROWS);
    readonly columns: GpoTableColumn[] = [{ title: 'Наименование', field: 'name' }];
}

@Component({
    standalone: true,
    imports: [GpoTableComponent],
    providers: [
        {
            provide: GPO_TABLE_ACTIONS,
            useValue: {
                isEdit: true,
                customActions: [
                    {
                        icon: 'copy',
                        label: 'Дублировать',
                        onClick: customActionSpy,
                    },
                ],
            } satisfies GpoTableActions<Row>,
        },
    ],
    template: `<gpo-table [dataSource]="dataSource" [columns]="columns" />`,
})
class CustomActionsHostComponent {
    readonly dataSource = staticGridifyDataSource(ROWS);
    readonly columns: GpoTableColumn[] = [{ title: 'Наименование', field: 'name' }];
}

@Component({
    standalone: true,
    imports: [GpoTableComponent],
    providers: [
        {
            provide: GPO_TABLE_ACTIONS,
            useValue: {
                isEdit: canEditSignal,
                onEdit: actionSpies.onEdit,
                onRemove: actionSpies.onRemove,
            } satisfies GpoTableActions<Row>,
        },
    ],
    template: `<gpo-table [dataSource]="dataSource" [columns]="columns" />`,
})
class DynamicActionsHostComponent {
    readonly dataSource = staticGridifyDataSource(ROWS);
    readonly columns: GpoTableColumn[] = [{ title: 'Наименование', field: 'name' }];
}

async function render(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

async function configure(component: Type<unknown>): Promise<void> {
    await TestBed.configureTestingModule({
        imports: [component],
        providers: [provideNoopAnimations()],
    }).compileComponents();
}

describe('GpoTableComponent', () => {
    beforeEach(() => {
        localStorage.clear();
        actionSpies.onEdit.calls.reset();
        actionSpies.onRemove.calls.reset();
        customActionSpy.calls.reset();
        canEditSignal.set(true);
        addSpy.calls.reset();
        addCanEditSignal.set(true);
        addLabelSignal.set('Создать');
    });

    it('рисует шапку, строки и шаблонную ячейку внутри table', async () => {
        await configure(HostComponent);
        const fixture = TestBed.createComponent(HostComponent);

        await render(fixture);

        const table = fixture.nativeElement.querySelector('table') as HTMLTableElement;
        expect(table).not.toBeNull();
        expect(table.querySelectorAll('thead th').length).toBe(2);
        expect(table.querySelectorAll('tbody tr').length).toBe(2);
        expect(table.querySelectorAll('.name-cell').length).toBe(2);
    });

    it('ограничивает высоту таблицы до низа окна', async () => {
        await configure(HostComponent);
        const fixture = TestBed.createComponent(HostComponent);
        await render(fixture);

        const scroll = fixture.nativeElement.querySelector('.gpo-table__scroll') as HTMLElement;
        expect(scroll.style.maxHeight).not.toBe('');
    });

    it('задаёт минимальную ширину таблицы, чтобы авто-колонки не схлопывались', async () => {
        await configure(HostComponent);
        const fixture = TestBed.createComponent(HostComponent);
        await render(fixture);

        const table = fixture.nativeElement.querySelector('table') as HTMLTableElement;
        expect(table.style.minWidth).not.toBe('');
    });

    it('сортирует строки по клику на заголовок', async () => {
        await configure(HostComponent);
        const fixture = TestBed.createComponent(HostComponent);
        await render(fixture);

        const sortButton = fixture.nativeElement.querySelector(
            'thead th button.gpo-table__sort',
        ) as HTMLButtonElement;
        sortButton.click();
        await render(fixture);

        const firstCell = fixture.nativeElement.querySelector('tbody tr td') as HTMLTableCellElement;
        expect(firstCell.textContent?.trim()).toBe('1');
    });

    it('показывает ошибку и загружает данные по кнопке «Повторить»', async () => {
        await configure(ErrorHostComponent);
        const fixture = TestBed.createComponent(ErrorHostComponent);
        await render(fixture);

        const state = fixture.nativeElement.querySelector('.gpo-table__state') as HTMLElement;
        expect(state.textContent).toContain('Нет данных');

        const retry = state.querySelector('button') as HTMLButtonElement;
        retry.click();
        await render(fixture);

        expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
        expect(fixture.nativeElement.querySelector('.gpo-table__state')).toBeNull();
    });

    it('смена размера страницы возвращает на первую и игнорирует хвостовую страницу', async () => {
        await configure(PaginationHostComponent);
        const fixture = TestBed.createComponent(PaginationHostComponent);
        await render(fixture);
        const table = fixture.componentInstance.table();

        await table.goToPage(6);
        await render(fixture);
        expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(7);

        // nz-pagination при смене размера присылает ещё и последнюю страницу — её не применяем
        void table.changePageSize(50);
        void table.goToPage(2);
        await render(fixture);

        expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(50);
        const firstCell = fixture.nativeElement.querySelector('tbody tr td') as HTMLTableCellElement;
        expect(firstCell.textContent?.trim()).toBe('1');
    });

    it('показывает обе стрелки сортировки и подсвечивает активную', async () => {
        await configure(HostComponent);
        const fixture = TestBed.createComponent(HostComponent);
        await render(fixture);

        const header = fixture.nativeElement.querySelector('thead th') as HTMLTableCellElement;
        const sortButton = header.querySelector('button') as HTMLButtonElement;
        const arrows = header.querySelectorAll('.gpo-table__sorter-arrow');
        expect(arrows.length).toBe(2);
        expect(header.querySelectorAll('.gpo-table__sorter-arrow--active').length).toBe(0);

        sortButton.click();
        await render(fixture);
        let active = header.querySelectorAll('.gpo-table__sorter-arrow--active');
        expect(active.length).toBe(1);
        expect(active[0].textContent?.trim()).toBe('▲');

        sortButton.click();
        await render(fixture);
        active = header.querySelectorAll('.gpo-table__sorter-arrow--active');
        expect(active.length).toBe(1);
        expect(active[0].textContent?.trim()).toBe('▼');

        sortButton.click();
        await render(fixture);
        expect(header.querySelectorAll('.gpo-table__sorter-arrow--active').length).toBe(0);
    });

    it('восстанавливает сохранённую ширину колонки', async () => {
        localStorage.setItem('gpo-table-columns:component-test', JSON.stringify({ id: 200 }));
        await configure(HostComponent);
        const fixture = TestBed.createComponent(HostComponent);
        await render(fixture);

        const th = fixture.nativeElement.querySelector('thead th') as HTMLElement;
        expect(th.style.width).toBe('200px');
    });

    it('сохраняет ширину колонки в localStorage', async () => {
        await configure(HostComponent);
        const fixture = TestBed.createComponent(HostComponent);
        await render(fixture);

        const th = fixture.nativeElement.querySelector('thead th') as HTMLElement;
        spyOn(th, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 120, 40));
        const handle = th.querySelector('.gpo-table__resize') as HTMLElement;

        handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, button: 0 }));
        document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 160 }));
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 160 }));
        await render(fixture);

        const stored = JSON.parse(
            localStorage.getItem('gpo-table-columns:component-test') ?? '{}',
        ) as Record<string, number>;
        expect(stored['id']).toBe(180);
    });

    it('не меняет минимальную ширину таблицы при отпускании колонки', async () => {
        await configure(HostComponent);
        const fixture = TestBed.createComponent(HostComponent);
        await render(fixture);

        const table = fixture.nativeElement.querySelector('table') as HTMLTableElement;
        const th = fixture.nativeElement.querySelector('thead th') as HTMLElement;
        spyOn(th, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 120, 40));
        const handle = th.querySelector('.gpo-table__resize') as HTMLElement;

        handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, button: 0 }));
        document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 160 }));
        await render(fixture);
        const widthDuringDrag = table.style.minWidth;

        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 160 }));
        await render(fixture);

        expect(widthDuringDrag).toBe('300px');
        expect(table.style.minWidth).toBe(widthDuringDrag);
    });

    it('рисует колонку действий и вызывает сервис редактирования', async () => {
        await configure(ActionsHostComponent);
        const fixture = TestBed.createComponent(ActionsHostComponent);
        await render(fixture);

        const actionsHeader = fixture.nativeElement.querySelector('thead th') as HTMLElement;
        expect(actionsHeader.getAttribute('aria-label')).toBe('Действия');

        const actionButton = fixture.nativeElement.querySelector(
            'tbody tr td .gpo-table__actions-button',
        ) as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await render(fixture);

        const editItem = Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).find((item) =>
            item.textContent?.includes('Редактировать'),
        ) as HTMLElement | undefined;
        expect(editItem).toBeDefined();
        editItem?.click();
        fixture.detectChanges();

        expect(actionSpies.onEdit).toHaveBeenCalled();
        const row = actionSpies.onEdit.calls.mostRecent().args[0] as Record<string, unknown>;
        expect(row['id']).toBe(3);
    });

    it('вызывает сервис удаления из меню действий', async () => {
        await configure(ActionsHostComponent);
        const fixture = TestBed.createComponent(ActionsHostComponent);
        await render(fixture);

        const actionButton = fixture.nativeElement.querySelector(
            'tbody tr td .gpo-table__actions-button',
        ) as HTMLButtonElement;
        actionButton.click();
        await render(fixture);

        const removeItem = Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).find((item) =>
            item.textContent?.includes('Удалить'),
        ) as HTMLElement | undefined;
        expect(removeItem).toBeDefined();
        expect(removeItem?.classList.contains('ant-menu-item-danger')).toBeFalse();
        expect(removeItem?.querySelector('.gpo-table__row-action-icon--danger')).not.toBeNull();
        removeItem?.click();
        fixture.detectChanges();

        expect(actionSpies.onRemove).toHaveBeenCalled();
        const removedRow = actionSpies.onRemove.calls.mostRecent().args[0] as Record<string, unknown>;
        expect(removedRow['id']).toBe(3);
    });

    it('показывает кастомные пункты меню строки и вызывает callback', async () => {
        await configure(CustomActionsHostComponent);
        const fixture = TestBed.createComponent(CustomActionsHostComponent);
        await render(fixture);

        const actionButton = fixture.nativeElement.querySelector(
            '.gpo-table__actions-button',
        ) as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await render(fixture);

        const customItem = Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).find((item) =>
            item.textContent?.includes('Дублировать'),
        ) as HTMLElement | undefined;
        expect(customItem).toBeDefined();
        customItem?.click();
        fixture.detectChanges();

        expect(customActionSpy).toHaveBeenCalled();
        const row = customActionSpy.calls.mostRecent().args[0] as Record<string, unknown>;
        expect(row['id']).toBe(3);
    });

    it('показывает кнопку добавления с настраиваемой подписью', async () => {
        await configure(AddActionsHostComponent);
        const fixture = TestBed.createComponent(AddActionsHostComponent);
        await render(fixture);

        const button = fixture.nativeElement.querySelector(
            '.gpo-table__add',
        ) as HTMLButtonElement;
        expect(button.textContent?.trim()).toBe('Создать');
        expect(fixture.nativeElement.querySelector('.gpo-table__actions-button')).toBeNull();

        button.click();
        expect(addSpy).toHaveBeenCalled();

        addLabelSignal.set(undefined);
        await render(fixture);
        expect(
            (
                fixture.nativeElement.querySelector('.gpo-table__add') as HTMLButtonElement
            ).textContent?.trim(),
        ).toBe('Добавить');

        addCanEditSignal.set(false);
        await render(fixture);
        expect(fixture.nativeElement.querySelector('.gpo-table__add')).toBeNull();
    });

    it('не рисует действия без права isEdit', async () => {
        await configure(ActionsDisabledHostComponent);
        const fixture = TestBed.createComponent(ActionsDisabledHostComponent);
        await render(fixture);

        expect(fixture.nativeElement.querySelector('.gpo-table__actions-button')).toBeNull();
        const firstHeader = fixture.nativeElement.querySelector('thead th') as HTMLElement;
        expect(firstHeader.getAttribute('aria-label')).not.toBe('Действия');
    });

    it('реагирует на смену isEdit-сигнала', async () => {
        await configure(DynamicActionsHostComponent);
        const fixture = TestBed.createComponent(DynamicActionsHostComponent);
        await render(fixture);

        expect(fixture.nativeElement.querySelector('.gpo-table__actions-button')).not.toBeNull();

        canEditSignal.set(false);
        await render(fixture);
        expect(fixture.nativeElement.querySelector('.gpo-table__actions-button')).toBeNull();

        canEditSignal.set(true);
        await render(fixture);
        expect(fixture.nativeElement.querySelector('.gpo-table__actions-button')).not.toBeNull();
    });

    it('склеивает базовый фильтр и фильтр поиска через AND', async () => {
        await configure(FilterHostComponent);
        const fixture = TestBed.createComponent(FilterHostComponent);
        await render(fixture);

        const queries = fixture.componentInstance.queries;
        expect(queries.length).toBe(1);
        expect(queries[0].filter).toBe('(status=active),(name_contains=тест)');
    });
});
