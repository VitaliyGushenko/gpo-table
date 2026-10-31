import { Component, Type, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { staticGridifyDataSource } from './adapters';
import { RegistryCellDirective } from './registry-cell.directive';
import { RegistryTableComponent } from './registry-table.component';
import { RegistryColumn, RegistryDataSource, RegistryQuery } from './registry-table.types';

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
    imports: [RegistryCellDirective, RegistryTableComponent],
    template: `
        <app-registry-table [dataSource]="dataSource" [columns]="columns" [pageSize]="2">
            <ng-template appRegistryCell="name" let-value="value">
                <span class="name-cell">{{ value }}</span>
            </ng-template>
        </app-registry-table>
    `,
})
class HostComponent {
    readonly dataSource = staticGridifyDataSource(ROWS);
    readonly columns: RegistryColumn[] = [
        { title: 'ID', field: 'id', type: 'number', isSortable: true },
        { title: 'Наименование', field: 'name' },
    ];
}

@Component({
    standalone: true,
    imports: [RegistryTableComponent],
    template: `<app-registry-table [dataSource]="dataSource" [columns]="columns" />`,
})
class ErrorHostComponent {
    private _calls = 0;

    readonly dataSource: RegistryDataSource<Row> = {
        getPage: async () => {
            this._calls += 1;
            if (this._calls === 1) {
                throw new Error('Нет данных');
            }
            return { rows: [{ id: 1, name: 'Alpha' }], total: 1 };
        },
    };

    readonly columns: RegistryColumn[] = [{ title: 'Наименование', field: 'name' }];
}

const PAGINATION_ROWS: readonly Row[] = Array.from({ length: 57 }, (_, index) => ({
    id: index + 1,
    name: `Строка ${index + 1}`,
}));

@Component({
    standalone: true,
    imports: [RegistryTableComponent],
    template: `<app-registry-table [dataSource]="dataSource" [columns]="columns" [pageSize]="10" />`,
})
class PaginationHostComponent {
    readonly dataSource = staticGridifyDataSource(PAGINATION_ROWS);
    readonly columns: RegistryColumn[] = [{ title: 'ID', field: 'id', type: 'number' }];
    readonly table = viewChild.required(RegistryTableComponent);
}

@Component({
    standalone: true,
    imports: [RegistryTableComponent],
    template: `
        <app-registry-table
            [dataSource]="dataSource"
            [columns]="columns"
            [filter]="baseFilter"
            [searchFilter]="searchFilter" />
    `,
})
class FilterHostComponent {
    readonly queries: RegistryQuery[] = [];
    readonly columns: RegistryColumn[] = [{ title: 'Наименование', field: 'name' }];
    readonly baseFilter = 'status=active';
    readonly searchFilter = 'name_contains=тест';
    readonly dataSource: RegistryDataSource<Row> = {
        getPage: async (query) => {
            this.queries.push(query);
            return { rows: [], total: 0 };
        },
    };
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

describe('RegistryTableComponent', () => {
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

    it('ограничивает высоту таблицы до низа окна и не включает горизонтальный скролл', async () => {
        await configure(HostComponent);
        const fixture = TestBed.createComponent(HostComponent);
        await render(fixture);

        const scroll = fixture.nativeElement.querySelector('.registry-table__scroll') as HTMLElement;
        expect(scroll.style.maxHeight).not.toBe('');
        expect(scroll.style.overflowX).toBe('hidden');
    });

    it('сортирует строки по клику на заголовок', async () => {
        await configure(HostComponent);
        const fixture = TestBed.createComponent(HostComponent);
        await render(fixture);

        const sortButton = fixture.nativeElement.querySelector(
            'thead th button.registry-table__sort',
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

        const state = fixture.nativeElement.querySelector('.registry-table__state') as HTMLElement;
        expect(state.textContent).toContain('Нет данных');

        const retry = state.querySelector('button') as HTMLButtonElement;
        retry.click();
        await render(fixture);

        expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
        expect(fixture.nativeElement.querySelector('.registry-table__state')).toBeNull();
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
        const arrows = header.querySelectorAll('.registry-table__sorter-arrow');
        expect(arrows.length).toBe(2);
        expect(header.querySelectorAll('.registry-table__sorter-arrow--active').length).toBe(0);

        sortButton.click();
        await render(fixture);
        let active = header.querySelectorAll('.registry-table__sorter-arrow--active');
        expect(active.length).toBe(1);
        expect(active[0].textContent?.trim()).toBe('▲');

        sortButton.click();
        await render(fixture);
        active = header.querySelectorAll('.registry-table__sorter-arrow--active');
        expect(active.length).toBe(1);
        expect(active[0].textContent?.trim()).toBe('▼');

        sortButton.click();
        await render(fixture);
        expect(header.querySelectorAll('.registry-table__sorter-arrow--active').length).toBe(0);
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
