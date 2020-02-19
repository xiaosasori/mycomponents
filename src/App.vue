<template lang="pug">
  div
    f-editable-table.items-table(
        :columns="columns" :rows="items" :context-actions="actions"
        @input="onInput($event)" @reorder="onReorder($event)")
        template(v-slot:header="{column}")
            | {{ column.name + (column.required ? '*' : '') }}
            f-help(v-if="column.help") {{ column.help }}
        // Specific rendering for cutpot
        template(v-slot:cell-cutpot="{cell}")
            f-product-icon(:icon="cell")
        //- template(v-slot:cell-price="{cell}")
        //-     i18n-n(v-if="cell !== null" :value="cell" :format="{key: 'currency', currency: al.currency}")
        //-         // This empty slot will disable the currency sign from rendering
        //-         template(v-slot:currency)
        template(v-slot:cell-input-origin="{cell, onInput}")
            f-autocomplete(
                :value="cell" @input="onInput"
                :resolver='searchOrigin')
        template(v-slot:cell-input-family="{row, cell, onInput}")
            f-autocomplete(
                :value="cell" @input="onInput"
                :resolverParams="{cutpot: row.cutpot}"
                :resolver='searchFamily'
                search-on-focus)
        template(v-slot:cell-input-variety="{row, cell, onInput}")
            f-autocomplete(
                :value="cell" @input="onInput"
                :resolverParams="{cutpot: row.cutpot, family: row.family}"
                :resolver='searchVariety')
        template(v-slot:cell-input-price="{cell, onInput}")
            v-text-field(
                type="number" :value="cell" @input="onInput"
                hide-details autocomplete="off" lang="en" :step="1 / 10 ** minorUnits")
</template>

<script>
import Vue from 'vue';
import {
        mdiContentCopy,
        mdiDeleteOutline,
        mdiTableRowPlusAfter,
        mdiTableRowPlusBefore
    } from '@mdi/js'
import FEditableTable from './components/FEditableTable/index.vue'
import items from './items.json'
import FHelp from '@/components/FHelp'
import FAutocomplete from '@/components/FAutocomplete'
import FProductIcon from '@/components/FProductIcon'

export default {
    name: 'App',

    components: {
        FEditableTable,
        FHelp,
        FAutocomplete,
        FProductIcon
    },

    data () {
        return {
            items: items,
            columns: [
                {name: 'cutpot'},
                {name: 'origin'},
                {name: 'family', required: true, rules: 'required'},
                {name: 'variety', required: true, rules: 'required'},
                {name: 'color'},
                {name: 'quantity', required: true, rules: 'required', type: 'number', help: 'Sll'},
                {name: 'unit', help: 'Bn cay'},
                {name: 'grade'},
                {name: 'price', required: true, rules: 'required', help: 'Gia'},
                {name: 'note', help: 'Note ne'}
            ],
            actions: [
                {
                    label: 'Add above',
                    handler: this.onAddAbove.bind(this),
                    icon: mdiTableRowPlusBefore
                },
                {
                    label: 'Add below',
                    handler: this.onAddBelow.bind(this),
                    icon: mdiTableRowPlusAfter
                },
                {
                    label: 'Duplicate',
                    handler: this.onCopy.bind(this),
                    icon: mdiContentCopy
                },
                {divider: true},
                {
                    label: 'Delete',
                    handler: this.onDelete.bind(this),
                    icon: mdiDeleteOutline
                }
            ],
            s: []

        }
    },
    methods: {
        searchOrigin (keyword) {
            const word = `${keyword || ''}`.trim()
            const params = {
                ...(word ? {word} : {})
            }
            return api.get('/api/autocomplete/origin', {params})
                .then(res => this.s = res.data)
        },
        searchFamily (keyword, {cutpot}) {
            const autocomplete = `${keyword || ''}`.trim()
            const params = {
                type: 'family',
                fields: 'word',
                match_cutpot: cutpot,
                ...(autocomplete ? {autocomplete} : {}),
                per_page: 10,
                order_by: 'word'
            }
            return api.get('/api/products', {params})
                .then(({data}) => data.map(product => product.word))
        },
        searchVariety (keyword, {cutpot, family}) {
            const autocomplete = `${family} ${keyword || ''}`.trim()
            const params = {
                type: 'variety',
                fields: 'word',
                match_cutpot: cutpot,
                ...(autocomplete ? {autocomplete} : {}),
                per_page: 10
            }
            return api.get('/api/products', {params})
                .then(({data}) => data.map(product => product.word))
        },
        onInput ({row, column, value}) {
            // Empty column means that something was pasted beyond the table's columns range
            // We don't handle this case
            if (!column) return

            if (column && !row) {
                // We need to make a new row
                this.addItems({
                    panelIndex: this.index,
                    itemNumber: 1
                })
                // eslint-disable-next-line no-param-reassign
                row = this.items[this.items.length - 1]
            }

            const rowIndex = this.items.indexOf(row)
            const path = `panels.${this.index}.items.${rowIndex}.${column.name}`

            // Quantity needs to be always integer
            if (column.name === 'quantity') {
                // eslint-disable-next-line no-param-reassign
                value = parseInt(value)
                // eslint-disable-next-line no-param-reassign
                if (isNaN(value)) value = null
            }

            // Ensure that we only round the price corresponding to the currency minor units
            if (column.name === 'price') {
                // eslint-disable-next-line no-param-reassign
                value = Number(parseFloat(value).toFixed(this.minorUnits))
                // eslint-disable-next-line no-param-reassign
                if (isNaN(value)) value = null
            }

            // Trigger validation
            this.validate({row, column, value})

            this[UPDATE_AL_STORE]({path, value})
        },
        onCopy ({rowIndex, rowIndexes}) {
            this.copyItems({
                panelIndex: this.index,
                itemIndexes: rowIndexes.length ? rowIndexes : [rowIndex],
                addIndex: (rowIndexes.length ? rowIndexes[rowIndexes.length - 1] : rowIndex) + 1
            })
        },
        onDelete ({rowIndex, rowIndexes}) {
            this.deleteItems({
                panelIndex: this.index,
                itemIndexes: rowIndexes.length ? rowIndexes : [rowIndex]
            })
        },
        onAddAbove ({rowIndex, rowIndexes}) {
            this.addItems({
                panelIndex: this.index,
                itemNumber: rowIndexes.length || 1,
                addIndex: rowIndexes.length ? rowIndexes[0] : rowIndex
            })
        },
        onAddBelow ({rowIndex, rowIndexes}) {
            this.addItems({
                panelIndex: this.index,
                itemNumber: rowIndexes.length || 1,
                addIndex: (rowIndexes.length ? rowIndexes[rowIndexes.length - 1] : rowIndex) + 1
            })
        },
        onReorder ({rows}) {
            this[UPDATE_AL_STORE]({
                path: `panels.${this.index}.items`,
                value: rows
            })
        },
    }
}
</script>
