# data-table — таблица реестра на сигналах

Переносимая таблица реестра: страница передаёт `dataSource` и `columns`, таблица сама грузит
страницы, хранит состояние и показывает загрузку/пусто/ошибку.

## Что внутри

| Файл | Роль |
|---|---|
| `registry-table.component.ts` | контейнер `app-registry-table`: входы, загрузка, слоты |
| `registry-table-head.component.ts` | шапка `thead[app-registry-table-head]`, сортировка |
| `registry-table-body.component.ts` | тело `tbody[app-registry-table-body]`, состояния |
| `registry-table-row.component.ts` | строка `tr[app-registry-table-row]`, ячейки |
| `registry-table-foot.component.ts` | футер `app-registry-table-foot`, итоги и пагинация |
| `registry-table-state.service.ts` | сигналы запроса, строк, агрегатов и ошибок |
| `registry-table-height.service.ts` | высота области таблицы до низа окна |
| `registry-column-resize.directive.ts` | ручка изменения ширины колонки |
| `registry-table-column-width.service.ts` | сохранение ширин в `localStorage` |
| `registry-table.types.ts` | `RegistryColumn`, `RegistryQuery`, `RegistryDataSource` и др. |
| `registry-table.helpers.ts` | чтение и форматирование значений, текст ошибки, склейка фильтров |
| `registry-search-fields.ts` | поля расширенного поиска из колонок |
| `registry-cell.directive.ts` | `ng-template[appRegistryCell]` |
| `adapters/` | `swaggerGridifyDataSource`, `staticGridifyDataSource` |
| `demo/` | демонстрационная страница, в публичный API не входит |

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
import { RegistryColumn, RegistryTableComponent } from 'src/app/lib/data-table';
import { staticGridifyDataSource } from 'src/app/lib/data-table/adapters';

type Row = { id: number; name: string; count: number; createdAt: string };

const ROWS: Row[] = [{ id: 1, name: 'Первая строка', count: 12, createdAt: '2026-01-15' }];

@Component({
    selector: 'app-items',
    standalone: true,
    imports: [RegistryTableComponent],
    template: `<app-registry-table [dataSource]="dataSource" [columns]="columns" />`,
})
export class ItemsComponent {
    readonly dataSource = staticGridifyDataSource(ROWS);
    readonly columns: RegistryColumn<keyof Row>[] = [
        { title: 'Наименование', field: 'name', isSortable: true },
        { title: 'Количество', field: 'count', type: 'number' },
        { title: 'Дата', field: 'createdAt', type: 'date' },
    ];
}
```

## Колонки

```ts
interface RegistryColumn<TField extends string = string> {
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
    search?: false | RegistrySearchSettings;
}
```

Шаблонная ячейка:

```html
<app-registry-table [dataSource]="dataSource" [columns]="columns">
    <ng-template appRegistryCell="id" let-row let-value="value">
        <button nz-button nzSize="small" (click)="$event.stopPropagation(); open(row)">Открыть</button>
    </ng-template>
</app-registry-table>
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

### Ширины колонок

Ширина меняется перетаскиванием ручки у правого края заголовка или стрелками клавиатуры
(фокус на ручке, `←`/`→`, `Shift` — крупнее). Минимальная ширина — 60px.

Если передан `storageKey`, ширины сохраняются в `localStorage` под ключом
`registry-table-columns:<storageKey>` и восстанавливаются при следующем открытии.
Без ключа resize работает, но не сохраняется. Сбросить ширины можно методом
`resetColumnWidths()` — он также удаляет ключ из `localStorage`.

```html
<app-registry-table
    [dataSource]="dataSource"
    [columns]="columns"
    storageKey="buy-registry" />
```

Колонку можно исключить из resize: `{ ...column, isResizable: false }`.

### Высота

Таблица всегда занимает доступную высоту до низа окна: сервис измеряет положение области
таблицы и высоту блока под ней (футер + слот `registryTableFooter`), вычитает `bottomOffset`.
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
readonly dataSource: RegistryDataSource<ItemRow> = {
    getPage: async (query) => {
        const response = await firstValueFrom(this._api.getItems(query.page, query.pageSize, query.filter));
        return { rows: response.data, total: response.count };
    },
};
```

`dataSource` должно быть стабильным полем класса, а не вызовом метода в шаблоне.

## Слоты над и под таблицей

```html
<app-registry-table [dataSource]="dataSource" [columns]="columns">
    <div registryTableHeader>Заголовок, кнопки, поиск</div>
    <div registryTableFooter>Примечание или свой футер</div>
</app-registry-table>
```

Внутри `<table>` слоты не работают: там только `ng-template appRegistryCell`.

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

1. Скопировать папку `data-table` в `src/client/ias/src/app/lib/data-table`.
2. Импорты внутри папки относительные — править ничего не нужно.
3. На странице оставить `dataSource`, `columns` и при необходимости `filter`/`searchFilter`.
4. Адаптер swagger использовать вместо прямых URL.
5. Проверить `npx tsc --noEmit -p tsconfig.app.json`, `ng build`, `ng test`.

Интеграция расширенного поиска (`advanced-search-rest`) в ядро не входит: она живёт отдельно
и подключается к слоту `registryTableHeader`. Ядро строит только описания полей
(`buildRegistrySearchFields`) и принимает готовую Gridify-строку через `searchFilter`.

## Чего нет в v1

Карточки, настройки колонок и `localStorage`, CRUD, фильтры-воронки в шапке, виртуальный скролл,
выделение строк, подсветка латинских символов, встроенный экспорт.
