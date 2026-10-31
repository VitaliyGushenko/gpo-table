# GraphQL в is_nsi: запросы, фрагменты, кодеген

Справочник по работе с GraphQL (Apollo Angular) во фронте. Загружается при написании/изменении запросов; общие правила кода — в скилле `dev`.

## Где живут запросы

- Фичевая папка `<фича>/graphql/`: `queries.ts` (все операции фичи) + `types/` (сгенерированные типы).
  Примеры: `projects/nsi/graphql/`, `projects/buy/graphql/`, `projects/buy/pages/centralized-purshases/graphql/`.
- Общие запросы и фрагменты — корневая `src/app/graphql/`: `queries.ts`, `fragments/`, `types/`, `graphql-schema.json`.
- Одиночный запрос допустимо держать рядом с сервисом (`projects/proplan/services/counterparty-unified.query.ts`), если у фичи нет своей graphql-папки.

## Именование операций

PascalCase, константа экспортируется рядом; суффиксы проекта — `Qry`/`Query`/`Qrys`:

```ts
export const CounterpartyUnifiedQry = gql`
    query CounterpartyUnified($where: JSON) {
        counterparties(where: $where) { ... }
    }
`;
```

- Имя константы и имя операции лучше держать одинаковыми (в старых файлах расходятся — не копировать).
- Фрагменты — суффикс `Fields`: `fragment UserAccessInfoFields on UserAccessInfo` (`src/app/graphql/fragments/user-access-*.fragment.ts`). Фичи свои фрагменты почти не заводят; переиспользуются сгенерированные **типы** между фичами (proplan берёт `CounterpartyUnified` из `projects/nsi/graphql/types/`).

## Использование в коде

Два паттерна, оба через инжект Apollo (`private readonly _apollo = inject(Apollo)` или `constructor(private readonly _apollo: Apollo)`):

```ts
// Поток данных (реактивно):
this._apollo
    .watchQuery<ProcurementProcedureResultQry>({
        query: ProcurementProcedureResult,
        variables,
        fetchPolicy: 'no-cache',
    })
    .valueChanges.pipe(map((e) => e.data.purchaseProcurementProcedureResultQries));

// Разовый запрос (из async-действия, по схеме try/catch/finally из скилла dev):
const result = await firstValueFrom(this._apollo.query<CounterpartyUnified>({ query, variables, fetchPolicy: 'no-cache' }));
```

- `fetchPolicy: 'no-cache'` — распространённый дефолт проекта; свежие данные важнее кэша. Если данные «не обновляются» — проверь fetchPolicy (скилл `debug`).
- Типы результата — только сгенерированные, из `types/` той же graphql-папки или соседней фичи; руками интерфейсы под запросы не писать.

## Кодеген

- `npm run gql-build:<модуль>` — `nsi`, `rem`, `buy`, `mid`, `sign`, `cp` (centralized-purshases); генерирует по файлу на операцию в `src/app/graphql/types/` + пер-модульные `globalType<Модуль>.ts` (enum/input-типы). Нужен локальный бэкенд на :10600.
- `npm run gql-load` — скачать схему в `graphql-schema.json`.
- `npm run verify:codegen` — проверка свежести (блокирует сборку). После изменения операций всегда регенерируй и коммить `[gen]` отдельно (скилл `commit`).
- Сгенерированное (`// @generated`) не правится руками (правило скилла `dev`).
