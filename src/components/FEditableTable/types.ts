import {inject, InjectionKey} from '@vue/composition-api'
import {VueConstructor} from 'vue'

export interface Row {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export interface Column {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
    name: string;
    displayName?: string;
    type?: string;
}

export interface TableInstance extends InstanceType<VueConstructor> {
    rows: Array<Row>;
    columns: Array<Column>;
    cursor: CursorInterface;
    localSelectedIndexes: SelectedIndexes;
    localSelectedCellRegion: SelectedCellRegion;
}
export const TableSymbol: InjectionKey<TableInstance> = Symbol('table')

export function getTable (): TableInstance {
    const $table = inject(TableSymbol)
    /* istanbul ignore next */
    if (!$table) throw Error('table not found')
    return $table
}

export interface CursorInterface {
    rowIndex: number;
    columnIndex: number;
    editing: boolean;
    top: number;
    left: number;
    width: number;
    height: number;
}
export const CursorSymbol: InjectionKey<CursorInterface> = Symbol('cursor')

export function getCursor (): CursorInterface {
    const cursor = inject(CursorSymbol)
    /* istanbul ignore next */
    if (!cursor) throw Error('cursor not found')
    return cursor
}

export interface CellMouseEvent {
    rowIndex: number;
    columnIndex: number;
    $event: MouseEvent;
}

export type SelectedIndexes = Array<number>

export interface SelectedCellRegion {
    start: {rowIndex: number; columnIndex: number};
    end: {rowIndex: number; columnIndex: number};
}

export interface ContextActionPayload {
    // The row and column where the cursor is
    row: Row;
    rowIndex: number;
    column: Column;
    columnIndex: number;
    // Selected rows and columns when selecting multiple rows/columns
    rows: Readonly<Array<Row>>;
    rowIndexes: Readonly<Array<number>>;
    columns: Readonly<Array<Column>>;
    columnIndexes: Readonly<Array<number>>;
}

export interface ContextAction {
    label: string | ((payload: ContextActionPayload) => string);
    handler: (payload: ContextActionPayload) => void;
    icon: string;
}
