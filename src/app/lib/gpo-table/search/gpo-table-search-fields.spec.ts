import { buildGpoTableSearchFields } from './gpo-table-search-fields';
import { GpoTableColumn } from '../core/gpo-table.types';

function columns(): GpoTableColumn[] {
    return [
        { title: 'ID', field: 'id', type: 'number' },
        { title: 'Наименование', field: 'name' },
        { title: 'Количество', field: 'count', type: 'number' },
        { title: 'Дата создания', field: 'createdAt', type: 'date' },
        { title: 'Статус', field: 'status', type: 'template' },
        { title: 'Комментарий', field: 'comment', search: false },
    ];
}

describe('buildGpoTableSearchFields', () => {
    it('строит поле для текстовой колонки как contains', () => {
        const field = buildGpoTableSearchFields([{ title: 'Наименование', field: 'name' }])[0];

        expect(field).toEqual({ key: 'name', field: 'name', title: 'Наименование', kind: 'contains' });
    });

    it('выбирает вид поиска по типу колонки', () => {
        const fields = buildGpoTableSearchFields(columns());

        expect(fields.map((field) => [field.key, field.kind])).toEqual([
            ['name', 'contains'],
            ['count', 'numberCondition'],
            ['createdAt', 'dateRange'],
        ]);
    });

    it('не включает id и template без явной настройки', () => {
        const keys = buildGpoTableSearchFields(columns()).map((field) => field.key);

        expect(keys).not.toContain('id');
        expect(keys).not.toContain('status');
    });

    it('не включает колонку с search: false', () => {
        const keys = buildGpoTableSearchFields(columns()).map((field) => field.key);

        expect(keys).not.toContain('comment');
    });

    it('включает id, если вид задан явно', () => {
        const fields = buildGpoTableSearchFields([{ title: 'ID', field: 'id', search: { kind: 'number' } }]);

        expect(fields).toEqual([{ key: 'id', field: 'id', title: 'ID', kind: 'number' }]);
    });

    it('справочник без kind делает поле select', () => {
        const dictionary = [{ label: 'Да', value: 1 }];
        const fields = buildGpoTableSearchFields([
            { title: 'Организация', field: 'orgCode', search: { dictionary } },
        ]);

        expect(fields[0]).toEqual({
            key: 'orgCode',
            field: 'orgCode',
            title: 'Организация',
            kind: 'select',
            dictionary,
        });
    });

    it('поддерживает множественный выбор со справочником', () => {
        const dictionary = [{ label: 'Оборудование', value: 'equipment' }];
        const fields = buildGpoTableSearchFields([
            { title: 'Категория', field: 'category', search: { kind: 'multipleSelect', dictionary } },
        ]);

        expect(fields[0].kind).toBe('multipleSelect');
        expect(fields[0].dictionary).toBe(dictionary);
    });

    it('переопределяет имя поля Gridify и заголовок', () => {
        const fields = buildGpoTableSearchFields([
            {
                title: 'Код ТМЦ',
                field: 'mtrCode',
                search: { kind: 'word', field: 'mtrCodeProjection', title: 'Код ТМЦ (по словам)' },
            },
        ]);

        expect(fields[0]).toEqual({
            key: 'mtrCode',
            field: 'mtrCodeProjection',
            title: 'Код ТМЦ (по словам)',
            kind: 'word',
        });
    });

    it('исключает дополнительный ключ строки', () => {
        const fields = buildGpoTableSearchFields(
            [
                { title: 'Ключ', field: 'rowKey' },
                { title: 'Наименование', field: 'name' },
            ],
            { excludedFields: ['rowKey'] },
        );

        expect(fields.map((field) => field.key)).toEqual(['name']);
    });

    it('оставляет скрытые колонки в поиске', () => {
        const fields = buildGpoTableSearchFields([{ title: 'Наименование', field: 'name', isVisible: false }]);

        expect(fields.map((field) => field.key)).toEqual(['name']);
    });

    it('сохраняет порядок колонок', () => {
        const fields = buildGpoTableSearchFields([
            { title: 'B', field: 'b' },
            { title: 'A', field: 'a' },
        ]);

        expect(fields.map((field) => field.key)).toEqual(['b', 'a']);
    });
});
