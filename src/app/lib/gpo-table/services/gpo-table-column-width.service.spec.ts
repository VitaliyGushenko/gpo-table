import { GpoTableColumnWidthService } from './gpo-table-column-width.service';

describe('GpoTableColumnWidthService', () => {
    const service = new GpoTableColumnWidthService();

    beforeEach(() => localStorage.clear());

    it('сохраняет и читает ширины колонок', () => {
        service.save('demo', { name: 180, count: 120.4 });

        expect(service.load('demo')).toEqual({ name: 180, count: 120 });
    });

    it('без ключа ничего не сохраняет и не читает', () => {
        service.save(undefined, { name: 180 });

        expect(service.load(undefined)).toEqual({});
    });

    it('отбрасывает слишком маленькие, нечисловые и битые значения', () => {
        localStorage.setItem(
            'gpo-table-columns:demo',
            JSON.stringify({ name: 20, count: '120', ok: 100, broken: null }),
        );

        expect(service.load('demo')).toEqual({ ok: 100 });
    });

    it('не падает на битом JSON', () => {
        localStorage.setItem('gpo-table-columns:demo', 'не json');

        expect(service.load('demo')).toEqual({});
    });

    it('удаляет сохранённые ширины', () => {
        service.save('demo', { name: 180 });

        service.clear('demo');

        expect(service.load('demo')).toEqual({});
    });
});
