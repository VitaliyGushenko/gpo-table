# gpo-table

Полигон для таблицы реестра `gpo-table`: Angular 19 + ng-zorro 19, данные в памяти.

- таблица — `src/app/lib/gpo-table/` (описание и перенос — `README.md` внутри папки);
- демо-страница — `src/app/demo/gpo-table-demo/gpo-table-demo.component.ts`;
- проектное задание — `src/gpo-table-v2-design.md`;
- расширенный поиск из рабочего проекта — `src/app/advanced-search-rest/` (референс,
  в сборку и тесты не входит: ему нужны зависимости проекта is_nsi).

## Запуск

```bash
npm install
npm start
```

Открывается демо-страница: сортировка, пагинация, шаблонные ячейки, агрегаты, фильтр,
имитация ошибки и повторной загрузки.

## Проверки

```bash
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
npx ng build
npx ng test --watch=false --browsers=ChromeHeadless
```
