<template lang="pug">
    span.cursor(:style="style" ref="cursor")
        v-tooltip(v-if="errorMessage" :value="true" :min-width="200" absolute :attach="$refs.cursor" )
            span {{ errorMessage }}
</template>

<style lang="sass" scoped>
    @import '~vuetify/src/styles/styles'

    .cursor
        position: absolute
        border: 2px solid map-get($light-green, 'darken-1')
        top: 0
        left: 0
        pointer-events: none
        ::v-deep .v-tooltip__content
            top: -2px !important
            left: calc(100% + 8px) !important
</style>

<script lang="ts">
    import {
        computed,
        defineComponent,
        getCurrentInstance,
        watch
    } from '@vue/composition-api'
    import debounce from 'lodash/debounce'
    import scrollIntoView from 'scroll-into-view-if-needed'

    import {CellMouseEvent, getCursor, getTable} from './types'
    import {
        getSelectedColumnIndexes,
        getSelectedRowIndexes
    } from './utils'

    export default defineComponent({
        setup () {
            updateCursorModelOnEvents()
            makeSureCursorStayInside()
            updateCursorCoordinationOnModelChanged()
            const {style} = setupCursorStyle()

            const cursor = getCursor()
            const $table = getTable()

            const errorMessage = computed((): string => {
                const row = $table.rows[cursor.rowIndex]
                const column = $table.columns[cursor.columnIndex]
                const errors = row?.$errors?.[column?.name]

                if (errors) {
                    return errors.join(', ')
                }
                return ''
            })

            return {
                style,
                errorMessage
            }
        }
    })

    function updateCursorModelOnEvents () {
        const $table = getTable()
        const cursor = getCursor()

        $table.$on('cellclick', moveCursor)
        $table.$on('table.contextmenu', moveCursor)

        function moveCursor ({rowIndex, columnIndex, $event}: CellMouseEvent) {
            // Safe-guard
            if (!(rowIndex !== undefined && columnIndex !== undefined)) {
                return
            }

            // If user right-click inside a selection region, do not move the cursor
            if ($event.button === 2 &&
                getSelectedRowIndexes($table).includes(rowIndex) &&
                getSelectedColumnIndexes($table).includes(columnIndex)) {
                return
            }

            if (columnIndex !== cursor.columnIndex || rowIndex !== cursor.rowIndex) {
                cursor.columnIndex = columnIndex
                cursor.rowIndex = rowIndex
            }
        }
    }

    function makeSureCursorStayInside () {
        const $table = getTable()
        const cursor = getCursor()

        // Make sure cursor stay inside the table when the number of rows has changed
        watch(() => $table.rows.length, (newRowsLength) => {
            if (newRowsLength - 1 < cursor.rowIndex) {
                cursor.rowIndex = newRowsLength - 1
            }
        })

        // Make sure cursor stay inside the table when the number of columns has changed
        watch(() => $table.columns.length, (newColumnsLength) => {
            if (newColumnsLength - 1 < cursor.columnIndex) {
                /* istanbul ignore next */
                cursor.columnIndex = newColumnsLength - 1
            }
        })
    }

    function updateCursorCoordinationOnModelChanged () {
        const $table = getTable()
        const cursor = getCursor()
        const vm = getCurrentInstance()

        /**
         * Given a column and a row, get its corresponding cell's coordination
         */
        function getCellCoordination ({columnIndex, rowIndex}) {
            const className = `.cell-${columnIndex}-${rowIndex}`
            const cell: HTMLElement = $table.$el.querySelector(className)
            if (!cell) return {width: 0, height: 0}

            return {
                top: cell.offsetTop,
                left: cell.offsetLeft,
                width: cell.offsetWidth,
                height: cell.offsetHeight
            }
        }

        /**
         * Update current cursor coordination.
         * Due to it is called on both row and column changes, we need to debounce it so
         * it won't be fired twice.
         */
        const updateCursorCoordination = debounce(() => {
            const newCoord = getCellCoordination($table.cursor)
            Object.assign(cursor, newCoord)

            // Scroll into view after the new coord takes effect
            requestAnimationFrame(() => {
                scrollIntoView(vm.$el, {scrollMode: 'if-needed'})
            })
        })

        /**
         * Whenever row and column of the cursor model has been changed,
         * update the cursor's coordinate
         */
        watch([() => cursor.rowIndex, () => cursor.columnIndex], updateCursorCoordination)
    }

    /**
     * From the cursor's model, build its CSS style so it will show up where we want it to
     */
    function setupCursorStyle () {
        const cursor = getCursor()

        return {
            style: computed(() => {
                // Hide the cursor when it is not on any cell yet
                if (!(cursor.width && cursor.height)) {
                    return {
                        display: 'none'
                    }
                }

                return {
                    width: `${cursor.width}px`,
                    height: `${cursor.height}px`,
                    transform: `translate(${cursor.left}px, ${cursor.top}px)`
                }
            })
        }
    }
</script>
