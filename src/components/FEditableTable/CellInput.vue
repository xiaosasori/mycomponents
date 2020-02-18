<template lang="pug">
    .cell-input(:style="style" :class="cellClass" @keydown.capture="onKeyDown")
        template(v-if="row && column")
            // These slot will be used when the cell is in edit mode (input is visible)
            // Specific slot for each column
            slot(v-if="editing" :name="'cell-input-' + column.name"
                    :row="row" :column="column" :cell="cell" :onInput="onInput")
                // Generic slot for all columns. Will be overriden by specific slot
                slot(name='cell-input' :row="row" :column="column" :cell="cell" :onInput="onInput")
                    // Default to render a v-text-field
                    v-text-field(hide-details autocomplete="off" :type="inputType"
                        :value="cell"
                        @input="onInput")
            // These slot will be used when the cell is in hidden mode
            // (input is not visible but still has focus)
            // Specific slot for each column
            slot(v-else :name="'cell-input-hidden-' + column.name"
                    :row="row" :column="column" :onInput="onInput")
                // Generic slot for all columns. Will be overriden by specific slot
                slot(name='cell-input-hidden' :row="row" :column="column" :onInput="onInput")
                    // Default to render a v-text-field
                    v-text-field(hide-details autocomplete="off"
                        :value="null" :type="inputType"
                        @input="onInput")
</template>

<style lang="sass" scoped>
    .cell-input
        position: absolute
        top: 0
        left: 0
        opacity: 0
        pointer-events: none
        background-color: #ffffff
        will-change: opacity, top, left, width
        &.editing
            opacity: 1
            pointer-events: initial
        ::v-deep
            .v-text-field
                margin: 0
                padding: 0
</style>

<script lang="ts">
    import {
        computed,
        createComponent,
        getCurrentInstance,
        Ref,
        ref,
        watch
    } from '@vue/composition-api'
    import debounce from 'lodash/debounce'

    import {getCursor, getTable} from './types'

    export default createComponent({
        setup () {
            const {style, cellClass} = setupCellStyle()
            const {row, column, cell, editing, inputType} = setupTemplateModels()
            const {onInput} = setupInputEvent(row, column)

            const {shouldNotSelectAllOnFocus} = makeSureInputAlwaysHaveFocus()
            const {enableEditMode, disableEditMode} = setupTogglingEditMode(shouldNotSelectAllOnFocus)
            const {onKeyDown} = setupNavigation({enableEditMode, disableEditMode})

            return {
                style,
                cellClass,
                onKeyDown,
                row,
                column,
                cell,
                editing,
                inputType,
                onInput
            }
        }
    })

    function setupCellStyle () {
        const $table = getTable()
        const cursor = getCursor()

        const style = computed(() => {
            const cursorBorderWidth = 2
            return {
                top: `${cursor.top + cursorBorderWidth}px`,
                left: `${cursor.left + cursorBorderWidth}px`,
                width: `${cursor.width - cursorBorderWidth * 2}px`
            }
        })

        const cellClass = computed(() => {
            return {
                editing: cursor.editing,
                [`cell-input--${$table.columns[cursor.columnIndex]?.name}`]: true
            }
        })

        return {
            style,
            cellClass
        }
    }

    function setupTemplateModels () {
        const cursor = getCursor()
        const $table = getTable()

        const row = computed(() => $table.rows[cursor.rowIndex])
        const column = computed(() => $table.columns[cursor.columnIndex])
        const cell = computed(() => row.value[column.value.name])

        return {
            row,
            column,
            cell,
            editing: computed(() => cursor.editing),
            inputType: computed(() => column.value.type || 'text')
        }
    }

    function setupInputEvent (row, column) {
        const $table = getTable()
        return {
            onInput ($event) {
                $table.$emit('input', {row: row.value, column: column.value, value: $event})
            }
        }
    }

    function makeSureInputAlwaysHaveFocus () {
        const $table = getTable()
        const cursor = getCursor()
        const vm = getCurrentInstance()
        const shouldNotSelectAllOnFocus = ref(false)

        /**
         * Focus on the input upon called
         */
        const focus = debounce(function () {
            // Find the input
            const input = getInput()
            if (!input) return

            // Focus if not already focus
            if (document.activeElement !== input) input.focus()

            // Select all texts inside
            if (shouldNotSelectAllOnFocus.value) {
                // eslint-disable-next-line no-param-reassign
                shouldNotSelectAllOnFocus.value = false
                vm.$nextTick(() => {
                    try {
                        input.selectionStart = input.selectionEnd
                    } catch (e) {
                        if (e.message.includes('selectionStart')) {
                            // Try setting selectionStart on a number input will cause exception
                            // This is safe to ignore
                        } else {
                            throw e
                        }
                    }
                })
            } else {
                vm.$nextTick(() => input.select())
            }
        // Wait until the input completes moving to new coordinate, otherwise the page
        // will be janked back to input's old position
        }, 16)

        // Refocus whenever the table's body was clicked
        $table.$on('bodyclick', focus)

        // Refocus when edit mode changes
        watch(() => cursor.editing, focus)

        function getInput (): HTMLInputElement {
            return vm.$el?.querySelector('input:not([type=hidden])')
        }

        return {
            shouldNotSelectAllOnFocus
        }
    }

    function setupTogglingEditMode (shouldNotSelectAllOnFocus: Ref<boolean>) {
        const $table = getTable()
        const cursor = getCursor()

        function enableEditMode (shouldNotSelectAll = false) {
            // eslint-disable-next-line no-param-reassign
            shouldNotSelectAllOnFocus.value = shouldNotSelectAll
            cursor.editing = true
        }

        function disableEditMode () {
            cursor.editing = false
        }

        // Disable edit mode when row or column changes
        watch([() => cursor.rowIndex, () => cursor.columnIndex], disableEditMode)

        // Switch to edit mode when user double clicks on a cell
        $table.$on('celldblclick', () => {
            // When this cell is in edit mode, and user double click to a new cell
            if (cursor.editing) {
                // Then we must disable edit mode first to destroy current component
                disableEditMode()
                // Then re-enable to show the input
                setTimeout(() => enableEditMode)
            } else {
                // Otherwise just show the input directly
                enableEditMode()
            }
        })

        return {
            enableEditMode,
            disableEditMode
        }
    }

    function setupNavigation ({enableEditMode, disableEditMode}: ReturnType<typeof setupTogglingEditMode>) {
        const cursor = getCursor()
        const $table = getTable()

        function onKeyDown (event) {
            // We do not want to alter behavior of most keys while in edit mode.
            // Only except:
            // + Tab: to move cursor to right/left cell
            // + Enter: to move cursor to below cell
            // + Esc: to exit edit mode
            if (cursor.editing && !(
                event.key === 'Tab' ||
                event.key === 'Enter' ||
                event.key === 'Escape')) {
                return
            }

            // Do not intercept any key combination with modifier
            if (event.ctrlKey || event.altKey || event.metaKey) return

            // Character key events should not be prevented so user could start typing
            // when cell is not in edit mode
            if (event.key.length === 1) {
                // If the cell is not in editing mode
                if (!cursor.editing) {
                    // Then enable it after first character has successfully been typed in
                    setTimeout(() => enableEditMode(true))
                }
                return
            }

            // Prevent default behavior of all keys
            event.preventDefault()

            navigateFromEvent(event)
        }

        function navigateFromEvent (event) {
            switch (event.key) {
            case 'Enter':
                // Integrate with vuetify's menuable component
                // Do not handle Enter if the menuable component is showing while in edit mode
                if (cursor.editing && document.querySelector('.v-menu__content.menuable__content__active')) {
                    break
                }

                if (!cursor.editing) {
                    // If not in edit mode, enable edit mode
                    enableEditMode(true)
                } else {
                    // If in edit mode, move cursor down
                    const cursorMoved = moveCursorDown({force: true})
                    // If the cursor wasn't moved (i.e., cursor at last line), manually disable edit mode
                    if (!cursorMoved) disableEditMode()
                }
                break
            case 'ArrowDown':
                moveCursorDown()
                break
            case 'ArrowUp':
                moveCursorUp()
                break
            case 'ArrowRight':
                moveCursorRight()
                break
            case 'ArrowLeft':
                moveCursorLeft()
                break
            case 'F2':
                enableEditMode(true)
                break
            case 'Escape':
                disableEditMode()
                break
            case 'Tab':
                // Ignore Alt+Tab or Ctrl+Tab
                if (event.ctrlKey || event.altKey) break

                if (!event.shiftKey) {
                    moveCursorRight({force: true, nextLineOnEnd: true})
                } else {
                    moveCursorLeft({force: true, prevLineOnStart: true})
                }
                break
            default:
                // console.log(event.key)
                break
            }
        }

        function moveCursorRight ({force = false, nextLineOnEnd = false} = {}) {
            if (cursor.editing && !force) return
            const nextIndex = cursor.columnIndex + 1
            if ($table.columns.length > nextIndex) {
                cursor.columnIndex = nextIndex
            } else if (nextLineOnEnd) {
                if (moveCursorDown({force})) {
                    cursor.columnIndex = 0
                }
            }
        }

        function moveCursorLeft ({force = false, prevLineOnStart = false} = {}) {
            if (cursor.editing && !force) return
            const prevIndex = cursor.columnIndex - 1
            if (prevIndex >= 0) {
                cursor.columnIndex = prevIndex
            } else if (prevLineOnStart) {
                if (moveCursorUp({force})) {
                    cursor.columnIndex = $table.columns.length - 1
                }
            }
        }

        function moveCursorDown ({force = false} = {}) {
            if (cursor.editing && !force) return false

            const nextIndex = cursor.rowIndex + 1
            if ($table.rows.length > nextIndex) {
                cursor.rowIndex = nextIndex
                return true
            }

            return false
        }

        /**
         * Move the cursor up
         * @returns {boolean}
         */
        function moveCursorUp ({force = false} = {}) {
            if (cursor.editing && !force) return false
            const prevIndex = cursor.rowIndex - 1
            if (prevIndex >= 0) {
                cursor.rowIndex = prevIndex
                return true
            }
            return false
        }

        return {
            onKeyDown
        }
    }
</script>
