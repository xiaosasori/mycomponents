<template lang="pug">
    td(:class="['f-editable-table__cell--' + column.name, 'cell-' + columnIndex + '-' + rowIndex]"
            v-on="on" :data-row-index="rowIndex" :data-column-index="columnIndex")
        // Error rendering
        template(v-if="row.$errors && row.$errors[column.name]")
            // Specific slot for each column
            slot(:name="'cell-error-' + column.name"
                    :row="row" :column="column" :cell="row[column.name]"
                    :rowIndex="rowIndex" :columnIndex="columnIndex")
                // Generic slot for all columns. Will be overriden by specific slot
                slot(name='cell-error' :row="row" :column="column" :cell="row[column.name]"
                        :rowIndex="rowIndex" :columnIndex="columnIndex")
                    // Default to just render a red error
                    span.red--text #ERROR
        // Value rendering
        template(v-else)
            // Specific slot for each column
            slot(:name="'cell-' + column.name"
                    :row="row" :column="column" :cell="row[column.name]"
                    :rowIndex="rowIndex" :columnIndex="columnIndex")
                // Generic slot for all columns. Will be overriden by specific slot
                slot(name='cell' :row="row" :column="column" :cell="row[column.name]"
                        :rowIndex="rowIndex" :columnIndex="columnIndex")
                    // Default to just render whatever value the cell is
                    | {{ row[column.name] }}
</template>

<style lang="sass" scoped>
    td
        user-select: none
        overflow: hidden
        white-space: nowrap
</style>

<script lang="ts">
    import {defineComponent} from '@vue/composition-api'
    import {PropType} from 'vue'

    import {
        CellMouseEvent,
        Column, getTable,
        Row
    } from './types'

    export default defineComponent({
        props: {
            column: {
                type: Object as PropType<Column>,
                required: true
            },
            row: {
                type: Object as PropType<Row>,
                required: true
            },
            rowIndex: {
                type: Number,
                required: true
            },
            columnIndex: {
                type: Number,
                required: true
            }
        },
        setup (props) {
            // eslint-disable-next-line no-unused-vars
            const on = setupEventHandlers(props)

            return {on}
        }
    })

    function setupEventHandlers (props: {rowIndex: number; columnIndex: number}) {
        const $table = getTable()

        function onClick ($event: MouseEvent) {
            $table.$emit('cellclick', {
                rowIndex: props.rowIndex,
                columnIndex: props.columnIndex,
                $event
            } as CellMouseEvent)
        }

        function onDoubleClick ($event: MouseEvent) {
            $table.$emit('celldblclick', {
                rowIndex: props.rowIndex,
                columnIndex: props.columnIndex,
                $event
            } as CellMouseEvent)
        }

        function onContextMenu (event: MouseEvent) {
            event.preventDefault()

            const $event: CellMouseEvent = {
                rowIndex: props.rowIndex,
                columnIndex: props.columnIndex,
                $event: event
            }

            $table.$emit('table.contextmenu', $event)
        }

        return {
            mousedown: onClick,
            dblclick: onDoubleClick,
            contextmenu: onContextMenu
        }
    }
</script>
