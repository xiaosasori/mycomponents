<template lang="pug">
    table.f-editable-table(@paste="onPaste" @copy="onCopy")
        thead
            tr
                th.f-editable-table__header--row-number
                th(v-for="(column, index) in columns" :key="index"
                        :class="'f-editable-table__header--' + column.name")
                    // Specific slot for each column
                    slot(:name="'header-' + column.name" :column="column")
                        // Generic slot for all columns. Will be overriden by specific slot
                        slot(name='header' :column="column")
                            // Default to just render the column name
                            | {{ column.displayName || column.name }}
        tbody(v-on="bodyEvents")
            row(v-for="(row, index) in rows" :row="row"
                    :row-index="index" :columns="columns" :key="index")
                // Pass-through all slots to row component.
                // May filter later to only pass cell* slots
                template(v-for="(_, slot) of $scopedSlots" v-slot:[slot]="scope")
                    slot(:name="slot" v-bind="scope")
            // This row is required to allow dragging selected rows to bottom of table
            // Clicking on this row should not trigger handlers
            tr.dummy-row(:class="`row-${rows.length}`" :data-index="rows.length" @click.prevent.stop)
                td(:colspan="columns.length + 1")
        cell-input(:cursor="cursor" @input="$emit('input', $event)")
            // Pass-through all slots to cell-input component.
            // May filter later to only pass cell-input* slots
            template(v-for="(_, slot) of $scopedSlots" v-slot:[slot]="scope")
                slot(:name="slot" v-bind="scope")
        cell-cursor(:cursor="cursor")
        context-menu(ref="contextMenu" :actions="contextActions")
        row-selection-region
        cell-selection-region
</template>

<style scoped lang="sass">
.f-editable-table
    width: 100%
    border-spacing: 0
    position: relative
    table-layout: fixed
    thead tr
        background-color: rgba(0, 0, 0, 0.02)
        height: 36px
        th
            font-size: 0.9em
            color: rgba(0, 0, 0, 0.54)
            text-align: center
            border-top: 1px solid rgba(0, 0, 0, 0.12)
            border-bottom: 1px solid rgba(0, 0, 0, 0.12)
    thead tr th, tbody ::v-deep tr td
        border-left: 1px solid rgba(0,0,0,0.12)
        &:last-child
            border-right: 1px solid rgba(0,0,0,0.12)
    tbody ::v-deep tr
        height: 36px
        &.dummy-row
            height: 8px
            td
                border-bottom: none
        &:hover td
            background-color: rgba(0, 0, 0, 0.02)
        td
            border-bottom: 1px solid rgba(0, 0, 0, 0.12)
</style>

<script lang="ts">
    import {
        createComponent,
        getCurrentInstance,
        PropType,
        provide,
        reactive,
        Ref,
        ref,
        watch
    } from '@vue/composition-api'
    import escape from 'lodash/escape'

    import {getCsvFromClipboardData} from '@/services/utils'

    import CellCursor from './CellCursor.vue'
    import CellInput from './CellInput.vue'
    import CellSelectionRegion from './CellSelectionRegion.vue'
    import ContextMenu from './ContextMenu.vue'
    import Row from './Row.vue'
    import RowSelectionRegion from './RowSelectionRegion.vue'
    import {CursorSymbol, getTable, SelectedCellRegion, SelectedIndexes, TableSymbol} from './types'

    export default createComponent({
        components: {
            ContextMenu,
            Row,
            CellInput,
            CellCursor,
            RowSelectionRegion,
            CellSelectionRegion
        },
        provide () {
            return {
                $table: this
            }
        },
        props: {
            columns: {
                type: Array,
                required: true
            },
            rows: {
                type: Array,
                required: true
            },
            contextActions: {
                type: Array,
                required: false,
                default: () => ([])
            },
            selectedIndexes: {
                type: Array as PropType<SelectedIndexes>,
                required: false,
                default: () => []
            },
            selectedCellRegion: {
                type: Object as PropType<SelectedCellRegion>,
                required: false,
                default: () => null
            }
        },
        setup (props) {
            const currentVm = getCurrentInstance()
            provide(TableSymbol, currentVm)

            const cursor = reactive({
                rowIndex: 0,
                columnIndex: 0,
                editing: false,
                top: 0,
                left: 0,
                width: 0,
                height: 0
            })
            provide(CursorSymbol, cursor)

            const localSelectedIndexes = setupSelectedIndexes(props)
            const localSelectedCellRegion = setupSelectedCellRegion(props)
            const onPaste = setupReceivingDataOnPaste()
            const onCopy = setupBuildCsvOnCopy()
            const bodyEvents = {
                click (event) {
                    currentVm.$emit('bodyclick', event)
                },
                mousedown (event) {
                    currentVm.$emit('bodymousedown', event)
                }
            }

            return {
                cursor,
                localSelectedIndexes,
                localSelectedCellRegion,
                onPaste,
                onCopy,
                bodyEvents
            }
        }
    })

    function setupSelectedIndexes (props: {selectedIndexes: SelectedIndexes}) {
        const localSelectedIndexesRef: Ref<SelectedIndexes> = ref([])
        const vm = getCurrentInstance()

        watch(() => props.selectedIndexes, (value) => {
            localSelectedIndexesRef.value = value
        })

        watch(localSelectedIndexesRef, (value) => {
            if (props.selectedIndexes !== value) {
                vm.$emit('update:selected-indexes', value)
            }
        })

        return localSelectedIndexesRef
    }

    function setupSelectedCellRegion (props: {selectedCellRegion: SelectedCellRegion}) {
        const selectedCellRegionRef: Ref<SelectedCellRegion> = ref(null)
        const vm = getCurrentInstance()

        watch(() => props.selectedCellRegion, (value) => {
            selectedCellRegionRef.value = value
        })

        watch(selectedCellRegionRef, (value) => {
            if (props.selectedCellRegion !== value) {
                vm.$emit('update:selected-cell-region', value)
            }
        })

        return selectedCellRegionRef
    }

    function setupReceivingDataOnPaste () {
        const $table = getTable()

        async function onPaste (event: ClipboardEvent) {
            event.preventDefault()

            const pastedItems = getCsvFromClipboardData(
                event.clipboardData || (window as unknown as {clipboardData: DataTransfer}).clipboardData
            )
            if (!pastedItems.length) return

            // Get the four corners of selected cell region
            const cellRegion = $table.localSelectedCellRegion
            let topIndex = Math.min(cellRegion.start.rowIndex, cellRegion.end.rowIndex)
            const bottomIndex = Math.max(cellRegion.start.rowIndex, cellRegion.end.rowIndex)
            const leftIndex = Math.min(cellRegion.start.columnIndex, cellRegion.end.columnIndex)
            // Only in case we also want to repeat columns
            // const rightIndex = max([cellRegion.start.columnIndex, cellRegion.end.columnIndex])

            // Start firing input events
            let rowsRepeated = false
            for (let i = 0; i < pastedItems.length; i++) {
                for (let j = 0; j < pastedItems[i].length; j++) {
                    $table.$emit('input', {
                        row: $table.rows[topIndex + i],
                        column: $table.columns[leftIndex + j],
                        value: pastedItems[i][j]
                    })
                    // If there should be a new row, we wait one tick for FEditableTable to
                    // receive new rows prop
                    if (topIndex + i >= $table.rows.length) {
                        await new Promise((resolve) => $table.$nextTick(resolve))
                    }
                }

                // Repeat rows if we haven't reach the bottomIndex yet
                if (i + 1 === pastedItems.length && topIndex + i < bottomIndex) {
                    i = -1
                    topIndex = topIndex + pastedItems.length
                    rowsRepeated = true
                }

                // Stop repeating rows if we have reached the bottomIndex
                if (rowsRepeated && topIndex + i >= bottomIndex) {
                    break
                }
            }
        }

        return onPaste
    }

    function setupBuildCsvOnCopy () {
        const $table = getTable()

        return function onCopy (event) {
            event.preventDefault()

            // Get the four corners of selected cell region
            const cellRegion = $table.localSelectedCellRegion
            const topIndex = Math.min(cellRegion.start.rowIndex, cellRegion.end.rowIndex)
            const bottomIndex = Math.max(cellRegion.start.rowIndex, cellRegion.end.rowIndex)
            const leftIndex = Math.min(cellRegion.start.columnIndex, cellRegion.end.columnIndex)
            const rightIndex = Math.max(cellRegion.start.columnIndex, cellRegion.end.columnIndex)

            // Get the data to copy into clipboard
            const rows = []
            for (let i = topIndex; i <= bottomIndex; i++) {
                const row = []
                for (let j = leftIndex; j <= rightIndex; j++) {
                    row.push($table.rows[i][$table.columns[j].name])
                }
                rows.push(row)
            }

            // Build HTML version
            let html = '<meta http-equiv="content-type" content="text/html; charset=utf-8">'
            html += '<table><tbody>'
            rows.forEach(row => {
                html += '<tr>'
                row.forEach((cell) => {
                    html += '<td>'
                    html += escape(`${cell}`)
                    html += '</td>'
                })
                html += '</tr>'
            })
            html += '</tbody></table>'
            event.clipboardData.setData('text/html', html)

            // Build text version
            const text = rows.map(row => row.join('\t')).join('\n')
            event.clipboardData.setData('text/plain', text)
        }
    }
</script>
