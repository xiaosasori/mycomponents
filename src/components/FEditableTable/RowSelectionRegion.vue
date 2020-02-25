<template lang="pug">
    span(:class="{'is-selecting': isSelecting, 'is-dragging': isDragging}")
        template(v-for="(style, index) in regionsStyles")
            span.f-editable-table__row-selection-region(
                :style="style" :key="'region' + index")
            span.f-editable-table__row-selection-region-holder(
                :style="style" :key="'region-holder' + index"
                v-on="regionHolderEvents")
        span.f-editable-table__drag-index(:style="dragIndexStyle")
</template>

<style scoped lang="sass">
    @import '~vuetify/src/styles/styles'

    .f-editable-table
        &__row-selection-region
            position: absolute
            width: 100%
            pointer-events: none
            background-color: rgba(map-get($light-green, 'darken-1'), .2)
        &__row-selection-region-holder
            position: absolute
            cursor: grab
            width: 36px // This must match with the first column width
            background-color: rgba(map-get($light-green, 'darken-1'), .2)
            .is-selecting &, .is-dragging &
                pointer-events: none // Hide when user is still selecting rows
        &__drag-index
            position: absolute
            display: none
            pointer-events: none
            width: 100%
            height: 2px
            background-color: map-get($light-green, 'darken-2')
            .is-dragging &
                display: block
</style>

<script lang="ts">
    /* eslint-disable no-param-reassign */
    import {computed, defineComponent, Ref, ref, watch} from '@vue/composition-api'
    import clone from 'lodash/clone'
    import concat from 'lodash/concat'
    import range from 'lodash/range'
    import sortBy from 'lodash/sortBy'
    import throttle from 'lodash/throttle'

    import {getCursor, getTable, Row, SelectedIndexes} from './types'

    interface RowRegion {
        start: number;
        end: number;
    }

    interface RowRegionStyle {
        top: string;
        left: string;
        height: string;
    }

    type IsSelectingRef = Ref<boolean>
    type IsDraggingRef = Ref<boolean>
    type DragIndexRef = Ref<number>

    export default defineComponent({
        setup () {
            const selectedIndexes = setupSelectedIndexes()
            const isSelecting: IsSelectingRef = ref(false)
            const isDragging: IsDraggingRef = ref(false)
            const dragIndex: DragIndexRef = ref(0)

            updateSelectionRegionsOnEvents(selectedIndexes, isSelecting)
            resetWhenCursorMoves(selectedIndexes, isSelecting)
            makeSureSelectedRegionStayInsideTable(selectedIndexes)
            const {regionsStyles} = setupRegionsStyles(selectedIndexes)
            const regionHolderEvents = moveRowsOnDraggingOnRegionHolder(selectedIndexes, isDragging, dragIndex)
            const dragIndexStyle = setupDragIndexStyle(dragIndex)

            return {
                regionsStyles,
                isSelecting,
                isDragging,
                regionHolderEvents,
                dragIndexStyle
            }
        }
    })

    function setupSelectedIndexes () {
        const $table = getTable()

        return computed({
            get () {
                return $table.localSelectedIndexes
            },
            set (value: SelectedIndexes) {
                $table.localSelectedIndexes = value
            }
        })
    }

    type SelectedIndexesRef = ReturnType<typeof setupSelectedIndexes>

    function makeSureSelectedRegionStayInsideTable (selectedIndexesRef: SelectedIndexesRef) {
        const $table = getTable()

        // When number of rows changes, remove all indexes that are not inside the table
        // from selected indexes
        watch(() => $table.rows.length, (newRowsLength) => {
            const newIndexes = selectedIndexesRef.value.filter(index => index < newRowsLength)
            if (newIndexes.length !== selectedIndexesRef.value.length) {
                selectedIndexesRef.value = newIndexes
            }
        })
    }

    function setupRegionsStyles (selectedIndexesRef: SelectedIndexesRef) {
        const $table = getTable()

        const selectionRegions = computed(() => {
            const sortedIndexes = sortBy(selectedIndexesRef.value)
            const regions: Array<RowRegion> = []

            if (!sortedIndexes.length) return regions

            let firstIndex = sortedIndexes[0]
            let lastIndex = sortedIndexes[0]

            for (const index of sortedIndexes) {
                if (lastIndex + 1 === index) {
                    // Move lastIndex by 1 when current index is consecutive with last one
                    lastIndex = index
                } else if (lastIndex + 1 < index) {
                    // If current index is not consecutive to last index
                    // We make a new region then reset the region indexes
                    regions.push({start: firstIndex, end: lastIndex})
                    firstIndex = index
                    lastIndex = index
                }
            }
            // Add the last region
            regions.push({start: firstIndex, end: lastIndex})

            return regions
        })

        const regionsStyles = computed(() => {
            const styles: Array<RowRegionStyle> = []

            for (const region of selectionRegions.value) {
                const startRow: HTMLElement = $table.$el?.querySelector(`.row-${region.start}`)
                const endRow: HTMLElement = $table.$el?.querySelector(`.row-${region.end}`)
                if (!startRow || !endRow) continue

                // Calculate the style of this region based on the start row and end row coordinate
                styles.push({
                    top: `${startRow.offsetTop}px`,
                    left: `${startRow.offsetLeft}px`,
                    height: `${endRow.offsetTop + endRow.offsetHeight - startRow.offsetTop}px`
                })
            }

            return styles
        })

        return {regionsStyles}
    }

    function updateSelectionRegionsOnEvents (
        selectedIndexesRef: SelectedIndexesRef,
        isSelecting: IsSelectingRef) {
            const $table = getTable()
            let firstIndexInSession: number = null
            let tbody: HTMLElement

            $table.$on('bodymousedown', (event) => {
                // Find the index of the row that the user has pressed mouse on
                const target = event.target as HTMLElement
                tbody = target.closest('tbody')
                const currentTr = target.closest('tr')
                const currentIndex = parseInt(currentTr.dataset.index)

                // User has clicked on the row number cell
                if (target.dataset.isRowNumber) {
                    // NOTE: No need for this code since the region holder will prevent this
                    // from happening
                    // Ignore if the index is already in the model
                    // if (selectedIndexes.value.includes(currentIndex)) {
                    //     return
                    // }

                    // If user is holding the Ctrl key, we need to keep the current list of selected
                    // indexes, otherwise clear everything
                    const currentSelectedIndexes = event.ctrlKey ? clone(selectedIndexesRef.value) : []

                    // If user is holding the Shift key
                    if (event.shiftKey) {
                        // We need to select all rows between:
                        // + the row that the cursor is currently in and
                        // + the row that user has just clicked
                        // We also need to set the origin of the selection session to be the row of
                        // the cursor, instead of the row that user has just clicked
                        firstIndexInSession = $table.cursor.rowIndex
                        let selectedIndexesInSession
                        if (firstIndexInSession <= currentIndex) {
                            selectedIndexesInSession = range(firstIndexInSession, currentIndex + 1)
                        } else {
                            selectedIndexesInSession = range(currentIndex, firstIndexInSession + 1)
                        }
                        selectedIndexesRef.value = concat(currentSelectedIndexes, selectedIndexesInSession)
                    } else {
                        // If user is not holding the shift key
                        // The origin row of the selection session will be the row that user has clicked on
                        firstIndexInSession = currentIndex

                        // Move the cursor to first cell of current row
                        $table.cursor.rowIndex = firstIndexInSession
                        $table.cursor.columnIndex = 0

                        // Add first row to the selection model
                        selectedIndexesRef.value = concat(currentSelectedIndexes, [firstIndexInSession])
                    }

                    // Announce that the user is in the process of selecting rows
                    isSelecting.value = true

                    // While user moving the mouse, also expand the selection
                    const onMouseMove = throttle((event) => {
                        const tr = event.target.closest('tr')
                        const currentIndex = parseInt(tr.dataset.index)
                        let selectedIndexesInSession
                        if (firstIndexInSession <= currentIndex) {
                            selectedIndexesInSession = range(firstIndexInSession, currentIndex + 1)
                        } else {
                            selectedIndexesInSession = range(currentIndex, firstIndexInSession + 1)
                        }
                        selectedIndexesRef.value = concat(currentSelectedIndexes, selectedIndexesInSession)
                    }, 16)
                    tbody.addEventListener('mousemove', onMouseMove)

                    // After user has released the mouse, stop expanding the selection
                    const onMouseUp = function () {
                        isSelecting.value = false
                        tbody.removeEventListener('mousemove', onMouseMove)
                        document.removeEventListener('mouseup', onMouseUp)
                    }
                    document.addEventListener('mouseup', onMouseUp)
                } else {
                    // User has clicked on regular cell
                    // Clear selection if:
                    // + there was some selection
                    // + either:
                    //      + left click
                    //      + right click on non-selected regions
                    if (selectedIndexesRef.value.length && (
                        event.button === 0 ||
                        (event.button === 2 && !selectedIndexesRef.value.includes(currentIndex))
                    )) {
                        selectedIndexesRef.value = []
                    }
                }
            })
        }

    function moveRowsOnDraggingOnRegionHolder (
        selectedIndexesRef: SelectedIndexesRef, isDraggingRef: IsDraggingRef, dragIndexRef: DragIndexRef) {
        const $table = getTable()

        function onMouseDown () {
            // Register event handlers
            const tbody: HTMLElement = $table.$el.querySelector('tbody')
            tbody.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)

            // Annoucing that we are dragging
            isDraggingRef.value = true

            // Set the style of the cursor
            document.body.style.cursor = 'pointer'

            // Reset the dragIndex
            dragIndexRef.value = null
        }

        const onMouseMove = throttle(function (event) {
            // Get the current index of the row
            const tr = (event.target as HTMLElement).closest('tr')
            const index = parseInt(tr.dataset.index)

            // Temporary set dragIndex to current row's index
            dragIndexRef.value = index

            // Check if index is in selected range
            if (selectedIndexesRef.value.includes(index)) {
                const indexes = sortBy(selectedIndexesRef.value)
                // Move the dragIndex to the smallest index that is in same consecutive range
                for (let i = indexes.indexOf(index) - 1; i >= 0; i--) {
                    if (indexes[i] + 1 === dragIndexRef.value) {
                        dragIndexRef.value = indexes[i]
                    } else {
                        break
                    }
                }
            }
        }, 16)

        function onMouseUp () {
            onMouseMove.flush()
            // De-register all event handlers
            const tbody: HTMLElement = $table.$el.querySelector('tbody')
            tbody.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)

            // Reset cursor style
            document.body.style.cursor = ''

            // Annoucing that we have stopped dragging
            isDraggingRef.value = false

            moveRows()

            // Reset the dragIndex
            dragIndexRef.value = null
        }

        function moveRows () {
            // Quit if the user hasn't started dragging yet
            if (dragIndexRef.value === null) return

            // Split the rows that are not in selected indexes and are in selected indexes
            const beforeDragIndex: Row[] = []
            const afterDragIndex: Row[] = []
            const selectedRows: Row[] = []
            for (let i = 0; i < $table.rows.length; i++) {
                if (selectedIndexesRef.value.includes(i)) {
                    selectedRows.push($table.rows[i])
                } else if (i < dragIndexRef.value) {
                    beforeDragIndex.push($table.rows[i])
                } else {
                    afterDragIndex.push($table.rows[i])
                }
            }

            // Re-merge the rows
            const newRows = [
                ...beforeDragIndex,
                ...selectedRows,
                ...afterDragIndex
            ]

            // Fire event
            $table.$emit('reorder', {rows: newRows})
            // Update the selected indexes
            selectedIndexesRef.value = selectedRows.map((r) => newRows.indexOf(r))

            if ($table.cursor.rowIndex !== selectedIndexesRef.value[0]) {
                // Update the cursor to follow the region
                $table.cursor.rowIndex = selectedIndexesRef.value[0]
                // Kind of a hack but work, prevent the selection region from resetting
                resetWhenCursorMoves.doNotReset = true
            }
        }

        return {
            mousedown: onMouseDown
        }
    }

    function setupDragIndexStyle (dragIndexRef: DragIndexRef) {
        const $table = getTable()
        return computed(() => {
            const rowClass = `.row-${dragIndexRef.value}`
            const currentRow: HTMLElement = $table.$el?.querySelector(rowClass)
            if (!currentRow) return {display: 'none'}
            return {
                top: `${currentRow.offsetTop}px`
            }
        })
    }

    const resetWhenCursorMoves = Object.assign(function (selectedIndexesRef: SelectedIndexesRef, isSelecting: IsSelectingRef) {
        const cursor = getCursor()

        watch([() => cursor.rowIndex, () => cursor.columnIndex], () => {
            // Ignore if user is still selecting rows
            if (isSelecting.value) return

            // Ignore if something tells this function to not reset
            if (resetWhenCursorMoves.doNotReset) {
                resetWhenCursorMoves.doNotReset = false
                return
            }

            // Otherwise reset
            selectedIndexesRef.value = []
        })
    }, {doNotReset: false})
</script>
