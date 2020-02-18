import {clone, range} from 'lodash-es'

import {Column, Row, TableInstance} from './types'

export function inInclusiveRange (number: number, start: number, end: number): boolean {
    return number >= Math.min(start, end) && number <= Math.max(start, end)
}

/**
 * Get the indexes of rows selected by row/cell selection region
 */
export function getSelectedRowIndexes ($table: TableInstance): number[] {
    if ($table.localSelectedIndexes.length) {
        const indexes = clone($table.localSelectedIndexes)
        indexes.sort((a, b) => a - b)
        return indexes
    }

    if ($table.localSelectedCellRegion) {
        const min = Math.min($table.localSelectedCellRegion.start.rowIndex, $table.localSelectedCellRegion.end.rowIndex)
        const max = Math.max($table.localSelectedCellRegion.start.rowIndex, $table.localSelectedCellRegion.end.rowIndex)
        return range(min, max + 1)
    }

    return []
}

/**
 * Convert indexes to actual rows. With safe-guard to not return undefined rows.
 */
export function toRows ($table: TableInstance, rowIndexes: number[]): Row[] {
    return $table.rows
        .map((row, index) => rowIndexes.includes(index) ? row : null)
        .filter(row => row !== null)
}

/**
 * Get the indexes of columns selected by cell selection region
 */
export function getSelectedColumnIndexes ($table: TableInstance): number[] {
    // If the table is in row selection mode, all columns are considered selected
    if ($table.localSelectedIndexes.length) {
        return range($table.columns.length)
    }

    if ($table.localSelectedCellRegion) {
        const min = Math.min($table.localSelectedCellRegion.start.columnIndex, $table.localSelectedCellRegion.end.columnIndex)
        const max = Math.max($table.localSelectedCellRegion.start.columnIndex, $table.localSelectedCellRegion.end.columnIndex)
        return range(min, max + 1)
    }

    return []
}

/**
 * Convert indexes to actual columns. With safe-guard to not return undefined columns.
 */
export function toColumns ($table: TableInstance, columnIndexes: number[]): Column[] {
    return $table.columns
        .map((column, index) => columnIndexes.includes(index) ? column : null)
        .filter(column => column !== null)
}
