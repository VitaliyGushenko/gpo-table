import { combineGridifyFilters, formatGpoTableValue, getErrorMessage, readGpoTableValue } from './gpo-table.helpers';
import { GpoTableColumn } from './gpo-table.types';

function column(patch: Partial<GpoTableColumn> = {}): GpoTableColumn {
    return { title: 'Поле', field: 'value', ...patch };
}

describe('gpo-table.helpers', () => {
    describe('readGpoTableValue', () => {
        it('читает простое поле строки', () => {
            expect(readGpoTableValue({ value: 'текст' }, 'value')).toBe('текст');
        });

        it('возвращает null и undefined как есть', () => {
            expect(readGpoTableValue({ value: null }, 'value')).toBeNull();
            expect(readGpoTableValue({ value: undefined }, 'value')).toBeUndefined();
        });

        it('не показывает вложенный объект без шаблонной колонки', () => {
            expect(readGpoTableValue({ value: { name: 'вложенное' } }, 'value')).toBeUndefined();
        });
    });

    describe('formatGpoTableValue', () => {
        it('показывает текст как есть, пустое значение — пустой строкой', () => {
            expect(formatGpoTableValue(42, column(), 'en-US')).toBe('42');
            expect(formatGpoTableValue(null, column(), 'en-US')).toBe('');
        });

        it('форматирует число с разделителями и заданным количеством знаков', () => {
            expect(formatGpoTableValue(1234.5, column({ type: 'number' }), 'en-US')).toBe('1,234.5');
            expect(formatGpoTableValue(1234.5, column({ type: 'number', numberDigits: 2 }), 'en-US')).toBe(
                '1,234.50',
            );
            expect(formatGpoTableValue(1234.56, column({ type: 'number', numberDigits: 0 }), 'en-US')).toBe('1,235');
        });

        it('показывает прочерк вместо нечислового значения', () => {
            expect(formatGpoTableValue('12', column({ type: 'number' }), 'en-US')).toBe('—');
            expect(formatGpoTableValue(Number.NaN, column({ type: 'number' }), 'en-US')).toBe('—');
        });

        it('форматирует дату по формату колонки', () => {
            const value = new Date(2026, 0, 15, 12);

            expect(formatGpoTableValue(value, column({ type: 'date' }), 'en-US')).toBe('15.01.2026');
            expect(formatGpoTableValue(value, column({ type: 'date', dateFormat: 'yyyy-MM-dd' }), 'en-US')).toBe(
                '2026-01-15',
            );
        });

        it('показывает прочерк для пустой даты и исходный текст для некорректной', () => {
            expect(formatGpoTableValue(null, column({ type: 'date' }), 'en-US')).toBe('—');
            expect(formatGpoTableValue('не дата', column({ type: 'date' }), 'en-US')).toBe('не дата');
        });
    });

    describe('getErrorMessage', () => {
        it('возвращает строку ошибки', () => {
            expect(getErrorMessage('Нет связи')).toBe('Нет связи');
        });

        it('берёт текст из тела ответа', () => {
            expect(getErrorMessage({ error: 'Ошибка сервера' })).toBe('Ошибка сервера');
            expect(getErrorMessage({ error: { Message: 'Ошибка из Message' } })).toBe('Ошибка из Message');
            expect(getErrorMessage({ error: { message: 'Ошибка из message' } })).toBe('Ошибка из message');
        });

        it('берёт message обычной ошибки', () => {
            expect(getErrorMessage(new Error('Сетевая ошибка'))).toBe('Сетевая ошибка');
        });

        it('возвращает запасной текст для неизвестной ошибки', () => {
            expect(getErrorMessage({})).toBe('Произошла ошибка');
            expect(getErrorMessage(null, 'Не удалось загрузить')).toBe('Не удалось загрузить');
        });
    });

    describe('combineGridifyFilters', () => {
        it('не создаёт фильтр из пустых значений', () => {
            expect(combineGridifyFilters()).toBeUndefined();
            expect(combineGridifyFilters(undefined, null, '   ')).toBeUndefined();
        });

        it('оборачивает каждую часть в скобки и склеивает через запятую', () => {
            expect(combineGridifyFilters('status=active', 'name_contains=тест')).toBe(
                '(status=active),(name_contains=тест)',
            );
        });

        it('обрезает пробелы и пропускает пустые части', () => {
            expect(combineGridifyFilters('  status=active  ', '', undefined)).toBe('(status=active)');
        });
    });
});
