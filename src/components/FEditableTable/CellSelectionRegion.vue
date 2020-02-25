<template lang="pug">
    span.f-editable-table__cell-selection-region(:style="style")
</template>

<style scoped lang="sass">
    @import '~vuetify/src/styles/styles'
    .f-editable-table__cell-selection-region
        position: absolute
        pointer-events: none
        background-color: rgba(map-get($light-green, 'darken-1'), .2)
</style>

<script lang="ts">
    /* eslint-disable no-param-reassign */
    import {computed, defineComponent, watch} from '@vue/composition-api'
    import isEqual from 'lodash/isEqual'
    import throttle from 'lodash/throttle'

    import {getCursor, getTable, SelectedCellRegion} from './types'
    import {inInclusiveRange} from './utils'

    export default defineComponent({
        setup () {
            const selectedCellRegion = setupSelectedCellRegion()
            const selectedCellRegionStyle = setupSelectedCellRegionStyle(selectedCellRegion)
            updateRegionOnEvents(selectedCellRegion)
            resetCellRegionWhenCursorMoves(selectedCellRegion)
            makeSureCellRegionStayInsideTable(selectedCellRegion)

            return {
                style: selectedCellRegionStyle
            }
        }
    })

    function setupSelectedCellRegion () {
        const $table = getTable()
        return computed({
            get () {
                return $table.localSelectedCellRegion
            },
            set (value: SelectedCellRegion) {
                $table.localSelectedCellRegion = value
            }
        })
    }

    type SelectedCellRegionRef = ReturnType<typeof setupSelectedCellRegion>

    function makeSureCellRegionStayInsideTable (selectedCellRegionRef: SelectedCellRegionRef) {
        const $table = getTable()

        // When the number of rows changes, make sure the selected cell region stay inside
        watch(() => $table.rows.length, (newRowsLength) => {
            if (selectedCellRegionRef.value?.start.rowIndex > newRowsLength - 1) {
                selectedCellRegionRef.value.start.rowIndex = newRowsLength - 1
            }
            if (selectedCellRegionRef.value?.end.rowIndex > newRowsLength - 1) {
                selectedCellRegionRef.value.end.rowIndex = newRowsLength - 1
            }
        })

        // When the number of columns changes, make sure the selected cell region stay inside
        watch(() => $table.columns.length, (newColumnsLength) => {
            /* istanbul ignore next */
            if (selectedCellRegionRef.value?.start.columnIndex > newColumnsLength - 1) {
                selectedCellRegionRef.value.start.columnIndex = newColumnsLength - 1
            }
            /* istanbul ignore next */
            if (selectedCellRegionRef.value?.end.columnIndex > newColumnsLength - 1) {
                selectedCellRegionRef.value.end.columnIndex = newColumnsLength - 1
            }
        })
    }

    function setupSelectedCellRegionStyle (selectedCellRegionRef: SelectedCellRegionRef) {
        const $table = getTable()

        return computed(() => {
            const cellRegion = selectedCellRegionRef.value
            const startCellClass = `.cell-${cellRegion?.start.columnIndex}-${cellRegion?.start.rowIndex}`
            const endCellClass = `.cell-${cellRegion?.end.columnIndex}-${cellRegion?.end.rowIndex}`
            const startCell: HTMLElement = $table.$el?.querySelector(startCellClass)
            const endCell: HTMLElement = $table.$el?.querySelector(endCellClass)
            if (!startCell || !endCell) return {display: 'none'}
            // If start cell and end cell is the same one, do not display
            if (startCell === endCell) return {display: 'none'}

            // Calculate the rectangle that is defined by start cell and end cell
            let top: number, left: number, width: number, height: number

            if (startCell.offsetLeft < endCell.offsetLeft) {
                left = startCell.offsetLeft
                width = endCell.offsetLeft + endCell.offsetWidth - left
            } else {
                left = endCell.offsetLeft
                width = startCell.offsetLeft + startCell.offsetWidth - left
            }

            if (startCell.offsetTop < endCell.offsetTop) {
                top = startCell.offsetTop
                height = endCell.offsetTop + endCell.offsetHeight - top
            } else {
                top = endCell.offsetTop
                height = startCell.offsetTop + startCell.offsetHeight - top
            }

            return {
                top: `${top}px`,
                left: `${left}px`,
                width: `${width}px`,
                height: `${height}px`
            }
        })
    }

    function updateRegionOnEvents (selectedCellRegionRef: SelectedCellRegionRef) {
        const $table = getTable()
        let tbody: HTMLElement

        $table.$on('bodymousedown', (event: MouseEvent) => {
            const target = (event.target as HTMLElement).closest('td')
            tbody = target.closest('tbody')

            // If user didn't clicked on any regular cell, clear the cell region
            if (!target.dataset.columnIndex) {
                selectedCellRegionRef.value = null
                return
            }

            const rowIndex = parseInt(target.dataset.rowIndex)
            const columnIndex = parseInt(target.dataset.columnIndex)

            // If user right clicked on a regular cell,
            // and the cell is in the current selected region, do not clear the selected region
            const cellRegion = selectedCellRegionRef.value
            if (event.button === 2 && cellRegion &&
                inInclusiveRange(rowIndex, cellRegion.start.rowIndex, cellRegion.end.rowIndex) &&
                inInclusiveRange(columnIndex, cellRegion.start.columnIndex, cellRegion.end.columnIndex)
            ) {
                return
            }

            selectedCellRegionRef.value = {
                start: {rowIndex, columnIndex},
                end: {rowIndex, columnIndex}
            }

            tbody.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
        })

        const onMouseMove = throttle(function (event) {
            const td = event.target.closest('td')
            if (!td.dataset.columnIndex) return

            selectedCellRegionRef.value = {
                start: selectedCellRegionRef.value.start,
                end: {
                    rowIndex: parseInt(td.dataset.rowIndex),
                    columnIndex: parseInt(td.dataset.columnIndex)
                }
            }
        }, 16)

        function onMouseUp () {
            tbody.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
        }
    }

    function resetCellRegionWhenCursorMoves (selectedCellRegionRef: SelectedCellRegionRef) {
        const cursor = getCursor()

        watch([() => cursor.rowIndex, () => cursor.columnIndex], () => {
            const newCellRegion = {
                start: {
                    rowIndex: cursor.rowIndex,
                    columnIndex: cursor.columnIndex
                },
                end: {
                    rowIndex: cursor.rowIndex,
                    columnIndex: cursor.columnIndex
                }
            }

            if (!isEqual(selectedCellRegionRef.value, newCellRegion)) {
                selectedCellRegionRef.value = newCellRegion
            }
        })
    }

</script>
