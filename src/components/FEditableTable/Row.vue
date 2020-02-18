<template lang="pug">
    tr(:class="`row-${rowIndex}`" :data-index="rowIndex")
        slot(name='before-row' :row-index="rowIndex")
        td.f-editable-table__cell--row-number(v-on="on" data-is-row-number="true")
            | {{ rowIndex + 1 }}
        cell(v-for="(column, index) in columns" :key="index"
                :column="column" :row="row"
                :row-index="rowIndex" :column-index="index")
            // Pass-through all slots to row component.
            template(v-for="(_, slot) of $scopedSlots" v-slot:[slot]="scope")
                slot(:name="slot" v-bind="scope")
</template>

<style scoped lang="sass">
    .f-editable-table__cell--row-number
        background-color: rgba(0,0,0,.02)
        user-select: none
</style>

<script lang="ts">
    import {getTable} from '@/components/FEditableTable/types'

    import Cell from './Cell.vue'

    export default {
        components: {Cell},
        props: {
            columns: {
                type: Array,
                required: true
            },
            row: {
                type: Object,
                required: true
            },
            rowIndex: {
                type: Number,
                required: true
            }
        },
        setup (props) {
            const on = setupEvents(props)

            return {
                on
            }
        }
    }

    function setupEvents (props) {
        const $table = getTable()

        function onContextMenu ($event: MouseEvent) {
            $event.preventDefault()
            $table.$emit('table.contextmenu', {row: props.row, $event})
        }

        return {
            contextmenu: onContextMenu
        }
    }
</script>
