# gpo-table — таблица реестра на сигналах

Переносимая таблица реестра: страница передаёт `dataSource` и `columns`, таблица сама грузит
страницы, хранит состояние и показывает загрузку/пусто/ошибку.

## Что внутри

| Файл | Роль |
|---|---|
| `components/gpo-table.component.ts` | контейнер `gpo-table`: входы, загрузка, слоты |
| `components/head/gpo-table-head.component.ts` | шапка `thead[gpo-table-head]`, сортировка |
| `components/body/gpo-table-body.component.ts` | тело `tbody[gpo-table-body]`, состояния |
| `components/row/gpo-table-row.component.ts` | строка `tr[gpo-table-row]`, ячейки |
| `components/row/gpo-table-row-actions.component.ts` | меню «⋯»: редактировать/удалить |
| `components/foot/gpo-table-foot.component.ts` | футер `gpo-table-foot`, итоги и пагинация |
| `services/gpo-table-state.service.ts` | сигналы запроса, строк, агрегатов и ошибок |
| `services/gpo-table-height.service.ts` | высота области таблицы до низа окна |
| `services/gpo-table-column-width.service.ts` | сохранение ширин в `localStorage` |
| `directives/gpo-table-column-resize.directive.ts` | ручка изменения ширины колонки |
| `directives/gpo-table-cell.directive.ts` | `ng-template[gpoTableCell]` |
| `core/gpo-table-actions.ts` | токен и интерфейс действий строки |
| `core/gpo-table.types.ts` | `GpoTableColumn`, `GpoTableQuery`, `GpoTableDataSource` и др. |
| `core/gpo-table.helpers.ts` | чтение и форматирование значений, текст ошибки, склейка фильтров |
| `search/gpo-table-search-fields.ts` | поля расширенного поиска из колонок |
| `adapters/` | `swaggerGridifyDataSource`, `staticGridifyDataSource` |

Демо — внешний потребитель и лежит вне переносимой папки: `src/app/demo/gpo-table-demo/`.

## Зависимости

- Angular 18+ (код совместим с 18 и 19);
- `ng-zorro-antd` (стили таблицы, пагинация, пустое состояние, кнопка, спиннер);
- `rxjs` — только в адаптере swagger.

Стили ng-zorro подключаются один раз в приложении:

```json
"styles": ["node_modules/ng-zorro-antd/ng-zorro-antd.min.css", "src/styles.less"]
```

Таблица собрана на нативной `<table>` с классами `ant-table`: ng-zorro объявляет свои компоненты
на `thead`/`tbody`, поэтому компоненты шапки и тела на тех же узлах дают ошибку NG0300. Загрузочный
оверлей — `nz-spin`, пагинация и пустое состояние — модули ng-zorro.

В Angular 19 в консоли будет предупреждение про `allowSignalWrites`: флаг оставлен для
совместимости с Angular 18, где без него запись сигналов в `effect` запрещена.

## Минимальная страница

```ts
import { GpoTableColumn, GpoTableComponent } from 'src/app/lib/gpo-table';
import { staticGridifyDataSource } from 'src/app/lib/gpo-table/adapters';

type Row = { id: number; name: string; count: number; createdAt: string };

const ROWS: Row[] = [{ id: 1, name: 'Первая строка', count: 12, createdAt: '2026-01-15' }];

@Component({
    selector: 'app-items',
    standalone: true,
    imports: [GpoTableComponent],
    template: `<gpo-table [dataSource]="dataSource" [columns]="columns" />`,
})
export class ItemsComponent {
    readonly dataSource = staticGridifyDataSource(ROWS);
    readonly columns: GpoTableColumn<keyof Row>[] = [
        { title: 'Наименование', field: 'name', isSortable: true },
        { title: 'Количество', field: 'count', type: 'number' },
        { title: 'Дата', field: 'createdAt', type: 'date' },
    ];
}
```

## Колонки

```ts
interface GpoTableColumn<TField extends string = string> {
    title: string;
    field: TField;
    type?: 'text' | 'number' | 'date' | 'template';
    width?: string;
    isSortable?: boolean;
    isResizable?: boolean;    // по умолчанию true
    isVisible?: boolean;
    align?: 'left' | 'center' | 'right';
    dateFormat?: string;      // по умолчанию dd.MM.yyyy
    numberDigits?: number;    // сколько знаков после запятой; без значения — до 2
    cssClass?: string;
    search?: false | GpoTableSearchSettings;
}
```

Колонка без `width` занимает оставшееся место, но в минимальной ширине таблицы учитывается
как 120px. Если все колонки не помещаются, появляется горизонтальный скролл — авто-колонка
не схлопывается в ноль.

Шаблонная ячейка:

```html
<gpo-table [dataSource]="dataSource" [columns]="columns">
    <ng-template gpoTableCell="id" let-row let-value="value">
        <button nz-button nzSize="small" (click)="$event.stopPropagation(); open(row)">Открыть</button>
    </ng-template>
</gpo-table>
```

Контекст шаблона: `$implicit`/`row`, `value`, `column`, `index`.

`row` типизирован как `Record<string, unknown>` — таблица не знает DTO страницы. Для
swagger-интерфейсов приводите строку к своему типу один раз в обработчике:
`open(row['id'] as number)`.

Сортировка: у сортируемых колонок всегда видны две стрелки, активная подсвечивается фоном.
Клик переключает `asc → desc → без сортировки`.

## Входы контейнера

| Вход | По умолчанию | Назначение |
|---|---|---|
| `columns` | — (обязателен) | описание колонок |
| `dataSource` | — (обязателен) | источник страниц |
| `filter` | — | постоянный Gridify-фильтр страницы |
| `searchFilter` | — | фильтр расширенного поиска, склеивается с `filter` через AND |
| `pageSize` | `150` | начальный размер страницы |
| `pageSizeOptions` | `[10, 30, 50, 100, 150, 200, 250]` | варианты размера |
| `rowKey` | `'id'` | ключ строки |
| `scrollWidth` | — | минимальная ширина таблицы; горизонтальный скролл появляется при переполнении |
| `storageKey` | — | ключ `localStorage` для ширин колонок; без него ширины живут только в памяти |
| `bottomOffset` | `0` | отступ снизу вне таблицы: padding страницы или внешний футер |
| `emptyText` | `'Данные не найдены'` | текст пустого состояния |
| `isShowFooter` | `true` | встроенный футер |
| `aggregatesTemplate` | — | свой блок итогов |

Выходы: `rowClick`, `rowDblClick`, `pageChange`, `pageSizeChange`, `sortChange`, `aggregatesLoaded`,
`totalChange`.

Публичные методы: `reload()`, `refreshHeight()`, `resetColumnWidths()`, `goToPage(page)`,
`changePageSize(size)`, `changeSort(sort)`.

### Действия таблицы и строки

Первая колонка с кнопкой «⋯» и кнопка добавления над таблицей появляются, если страница
провайдит сервис действий под токеном `GPO_TABLE_ACTIONS`. Входов для этого у таблицы нет —
один сервис можно расширять новыми флагами и методами.

```ts
import {
    GPO_TABLE_ACTIONS,
    GpoTableActions,
} from 'src/app/lib/gpo-table';

@Injectable()
export class ItemsActions implements GpoTableActions<ItemRow> {
    readonly isEdit = true;
    /** Подпись кнопки добавления; без неё — «Добавить» */
    readonly addLabel = 'Добавить запись';

    onAdd(): void {
        // открыть форму добавления
    }

    onEdit(row: ItemRow): void {
        // открыть модалку редактирования
    }

    onRemove(row: ItemRow): void {
        // подтвердить и удалить, затем table.reload()
    }
}

@Component({
    providers: [{ provide: GPO_TABLE_ACTIONS, useClass: ItemsActions }],
    template: `<gpo-table [dataSource]="dataSource" [columns]="columns" />`,
})
export class ItemsComponent {}
```

Правила:

- нет провайдера токена — колонки действий и кнопки добавления нет;
- `isEdit: true` разрешает добавление, редактирование и удаление; `isEdit: false` скрывает
  и колонку, и кнопку добавления;
- вместо boolean можно передать сигнал/функцию — таблица будет реагировать на смену прав;
- кнопка добавления стоит в шапке над таблицей, левее переданного контента, и показывается
  при наличии `onAdd`; её подпись берётся из `addLabel`, по умолчанию — «Добавить»;
- «Редактировать» показывается, если задан `onEdit`; «Удалить» — если задан `onRemove`;
- если оба метода не заданы — первая колонка не рисуется, но кнопка добавления может остаться;
- добавление не обязано иметь строковое меню: сервис может реализовать только `onAdd`;
- удаление подтверждает страница/сервис, таблица только вызывает метод;
- после успешного действия страница сама вызывает `table.reload()`;
- колонка действий фиксированной ширины 64px, не сортируется и не ресайзится;
- методы могут возвращать `Promise`, таблица их не ждёт и не показывает свой прогресс.

### Ширины колонок

Ширина меняется перетаскиванием ручки у правого края заголовка. Минимальная ширина — 60px.

Если передан `storageKey`, ширины сохраняются в `localStorage` под ключом
`gpo-table-columns:<storageKey>` и восстанавливаются при следующем открытии.
Без ключа resize работает, но не сохраняется. Сбросить ширины можно методом
`resetColumnWidths()` — он также удаляет ключ из `localStorage`.

```html
<gpo-table
    [dataSource]="dataSource"
    [columns]="columns"
    storageKey="buy-gpo-table" />
```

Колонку можно исключить из resize: `{ ...column, isResizable: false }`.

### Высота

Таблица всегда занимает доступную высоту до низа окна: сервис измеряет положение области
таблицы и высоту блока под ней (футер + слот `gpoTableFooter`), вычитает `bottomOffset`.
Ограничение задаётся как `max-height`, поэтому при малом числе строк таблица остаётся
по содержимому, а при большом — появляется вертикальный скролл, шапка остаётся видимой.
Горизонтальный скролл появляется только при переполнении колонок; `scrollWidth` задаёт
минимальную ширину таблицы.

## Источники данных

Сгенерированный swagger-клиент:

```ts
readonly dataSource = swaggerGridifyDataSource<ItemRow, Aggregates>(
    (query) => this._api.itemsGetItemsQry(query.page, query.pageSize, query.orderBy, query.filter),
    (query) => this._api.itemsGetItemsAggregates(1, 1, undefined, query.filter),
);
```

Своя реализация — тот же интерфейс:

```ts
readonly dataSource: GpoTableDataSource<ItemRow> = {
    getPage: async (query) => {
        const response = await firstValueFrom(this._api.getItems(query.page, query.pageSize, query.filter));
        return { rows: response.data, total: response.count };
    },
};
```

`dataSource` должно быть стабильным полем класса, а не вызовом метода в шаблоне.

## Слоты над и под таблицей

```html
<gpo-table [dataSource]="dataSource" [columns]="columns">
    <div gpoTableHeader>Заголовок, кнопки, поиск</div>
    <div gpoTableFooter>Примечание или свой футер</div>
</gpo-table>
```

Внутри `<table>` слоты не работают: там только `ng-template gpoTableCell`.

## Состояние

- `query` — единственный источник истины: страница, размер, сортировка, фильтр;
- ответ применяется, только если объект запроса всё ещё актуален (защита от гонок);
- смена фильтра, размера и сортировки возвращает на первую страницу;
- агрегаты зависят только от фильтра: смена страницы или сортировки их не отменяет
  и не перезапрашивает;
- ошибка агрегатов не очищает строки;
- `isEmpty` истинно только после первой загрузки и пустого ответа — до загрузки это `false`;
- пустая последняя страница автоматически заменяется последней существующей.

## Перенос на работу

1. Скопировать папку `gpo-table` в `src/client/ias/src/app/lib/gpo-table`.
2. Импорты внутри папки относительные — править ничего не нужно.
3. На странице оставить `dataSource`, `columns` и при необходимости `filter`/`searchFilter`.
4. Адаптер swagger использовать вместо прямых URL.
5. Проверить `npx tsc --noEmit -p tsconfig.app.json`, `ng build`, `ng test`.

Интеграция расширенного поиска (`advanced-search-rest`) в ядро не входит: она живёт отдельно
и подключается к слоту `gpoTableHeader`. Ядро строит только описания полей
(`buildGpoTableSearchFields`) и принимает готовую Gridify-строку через `searchFilter`.

## Чего нет в v1

Карточки, настройки колонок и `localStorage`, CRUD, фильтры-воронки в шапке, виртуальный скролл,
выделение строк, подсветка латинских символов, встроенный экспорт.
