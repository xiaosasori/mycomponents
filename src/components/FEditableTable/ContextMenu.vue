<template lang="pug">
    v-menu(v-model="menuShown" absolute :position-x="x" :position-y="y" offset-y
            content-class="f-editable-table__context-menu" )
        v-list(dense)
            template(v-for="(action, index) in actions")
                v-divider(v-if="action.divider" :key="index")
                v-list-item(v-else :key="index" @click="onActionClick(action)")
                    v-list-item-icon(v-if="hasIcon")
                        v-icon(v-if="action.icon") {{ action.icon }}
                    v-list-item-title {{ getLabel(action) }}
</template>

<style lang="sass">
    .f-editable-table__context-menu
        min-width: 200px !important
        .v-list .v-list-item
            &__icon
                // Reduce big margin between icon and text in default style
                margin-right: 16px
            &__title
                // Disable bold text caused by dense list style
                font-weight: normal
</style>

<script lang="ts">
    import {computed, defineComponent, PropType, reactive, toRefs} from '@vue/composition-api'

    import {
        CellMouseEvent,
        ContextAction,
        ContextActionPayload,
        getCursor,
        getTable
    } from './types'
    import {
        getSelectedColumnIndexes,
        getSelectedRowIndexes,
        toColumns,
        toRows
    } from './utils'

    export default defineComponent({
        inject: ['$table'],
        props: {
            actions: {
                type: Array as PropType<Array<ContextAction>>,
                required: true
            }
        },
        setup (props) {
            const model = setupModel()
            const $table = getTable()
            const cursor = getCursor()

            showContextMenuOnEvent(model)

            /**
             * Check whether any of the action has icon
             */
            const hasIcon = computed(() => {
                return props.actions.some(action => action.icon)
            })

            const actionPayload = computed((): ContextActionPayload => {
                const rowIndexes = getSelectedRowIndexes($table)
                const rows = toRows($table, rowIndexes)
                const columnIndexes = getSelectedColumnIndexes($table)
                const columns = toColumns($table, columnIndexes)
                return {
                    row: $table.rows[cursor.rowIndex],
                    rowIndex: cursor.rowIndex,
                    column: $table.columns[cursor.columnIndex],
                    columnIndex: cursor.columnIndex,
                    rows,
                    rowIndexes,
                    columns,
                    columnIndexes
                }
            })

            /**
             * Trigger the handler of the context action
             */
            const onActionClick = (action: ContextAction): void => {
                action.handler(actionPayload.value)
            }

            /**
             * Get the actual label for an action
             */
            const getLabel = (action: ContextAction): string => {
                if (typeof action.label === 'function') {
                    return action.label(actionPayload.value)
                } else {
                    // Since we don't use this yet, temporary ignore from cov
                    /* istanbul ignore next */
                    return action.label
                }
            }

            return {
                ...toRefs(model),
                actionPayload,
                hasIcon,
                onActionClick,
                getLabel
            }
        }
    })

    function setupModel () {
        return reactive({
            menuShown: false,
            x: 0,
            y: 0
        })
    }

    // eslint-disable-next-line no-undef
    function showContextMenuOnEvent (model: ReturnType<typeof setupModel>) {
        const $table = getTable()

        $table.$on('table.contextmenu', ({$event}: CellMouseEvent) => {
            model.x = $event.clientX
            model.y = $event.clientY
            model.menuShown = true
        })
    }
</script>
