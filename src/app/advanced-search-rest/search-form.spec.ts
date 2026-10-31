import { typedGridify } from 'src/app/lib/typed-gridify';

import { applySearchForm } from './search-form';

interface Row {
    name?: string;
}

const buildNameFilter = (value: string, mode: 'FULL' | 'PARTIAL', connect: 'AND' | 'OR'): string => {
    const builder = typedGridify<Row>();
    applySearchForm(builder, { name: value }, { name: { kind: 'wordSearch', mode: () => mode } }, { connect });
    return builder.build().filter ?? '';
};

describe('applySearchForm — поиск по словам (наименование)', () => {
    it('«По полному» + И: каждое слово — целым словом, пробелы паттернов экранированы', () => {
        expect(buildNameFilter('Провод ПВ', 'FULL', 'AND')).toBe(
            '(name^Провод\\ /i|name=*\\ Провод\\ /i|name$\\ Провод/i|name=Провод/i)' +
                ',(name^ПВ\\ /i|name=*\\ ПВ\\ /i|name$\\ ПВ/i|name=ПВ/i)',
        );
    });

    it('«По полному» + ИЛИ: достаточно любого паттерна любого слова', () => {
        expect(buildNameFilter('Провод ПВ', 'FULL', 'OR')).toBe(
            '(name^Провод\\ /i|name=*\\ Провод\\ /i|name$\\ Провод/i|name=Провод/i' +
                '|name^ПВ\\ /i|name=*\\ ПВ\\ /i|name$\\ ПВ/i|name=ПВ/i)',
        );
    });

    it('«По частичному» + И: каждое слово — подстрокой', () => {
        expect(buildNameFilter('Провод ПВ', 'PARTIAL', 'AND')).toBe('name=*Провод/i,name=*ПВ/i');
    });

    it('«По частичному» + ИЛИ: достаточно любого слова', () => {
        expect(buildNameFilter('Провод ПВ', 'PARTIAL', 'OR')).toBe('(name=*Провод/i|name=*ПВ/i)');
    });
});
