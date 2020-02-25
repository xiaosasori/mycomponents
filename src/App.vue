<template lang="pug">
  v-app
    v-content
        f-editable-table.items-table(
            :columns="columns" :rows="items" :context-actions="actions"
            @input="onInput($event)" @reorder="onReorder($event)")
            template(v-slot:header="{column}")
                | {{ column.name + (column.required ? '*' : '') }}
                f-help(v-if="column.help") {{ column.help }}
            // Specific rendering for cutpot
            template(v-slot:cell-cutpot="{cell}")
                f-product-icon(:icon="cell")
            template(v-slot:cell-price="{cell}")
                | {{cell}}
                //- i18n-n(v-if="cell !== null" :value="cell" :format="{key: 'currency', currency: al.currency}")
                //-     // This empty slot will disable the currency sign from rendering
                //-     template(v-slot:currency)
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
import {validate} from 'vee-validate'
// import {createNamespacedHelpers} from 'vuex'
// import api from '@/common/services/api'
import CURRENCIES from '@/services/currencies.json'
import FEditableTable from './components/FEditableTable/index.vue'
import {items, search} from './items'
import {changeTracker} from '@/services/utils'
import FHelp from '@/components/FHelp'
import FAutocomplete from '@/components/FAutocomplete'
import FProductIcon from '@/components/FProductIcon'

// import {UPDATE_AL_STORE} from '@/vendor/store/mutation-types'
// import {STORE_NS} from '../constants'
// import AddItems from './AddItems'
// import PanelMixin from './PanelMixin'

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
            index: 0,
            al: {
                "available_from": "2019-07-22T17:00:00Z",
                "available_until": "2019-07-30T17:00:00Z",
                "currency": "USD",
                "id": "AIEFHK3TQACT2",
                "image": {
                    "original_height": 3008,
                    "original_width": 2000,
                    "url": "https://d2uaslj856bt5z.cloudfront.net/AdLrJYGABAE/AghTq3OABT0/AgiZv5cABXo.jpeg"
                },
                "introduction": "demo",
                "method": "C&F",
                "minimum_order_amount": 0,
                "title": "demo",
                "vendor": {
                    "country": "Taiwan",
                    "name": "First Vendor"
                }
            },
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
            ]

        }
    },
    computed: {
        minorUnits () {
            // eslint-disable-next-line camelcase
            return CURRENCIES[this.al.currency]?.minor_units || 0
        }
    },
    methods: {
        searchOrigin (keyword) {
            console.log('searchOrigin')
            const word = `${keyword || ''}`.trim()
            const params = {
                ...(word ? {word} : {})
            }
            return search
            // return api.get('/api/autocomplete/origin', {params})
            //     .then(res => this.s = res.data)
        },
        searchFamily (keyword, {cutpot}) {
            console.log('searchFamily')
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
            console.log('searchVariety')
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
            console.log('onInput')
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

            // this[UPDATE_AL_STORE]({path, value})
            this.items[rowIndex][column.name] = value
        },
        onCopy ({rowIndex, rowIndexes}) {
            console.log('onCopy')
            this.copyItems({
                panelIndex: this.index,
                itemIndexes: rowIndexes.length ? rowIndexes : [rowIndex],
                addIndex: (rowIndexes.length ? rowIndexes[rowIndexes.length - 1] : rowIndex) + 1
            })
        },
        onDelete ({rowIndex, rowIndexes}) {
            console.log('onDelete')
            this.deleteItems({
                panelIndex: this.index,
                itemIndexes: rowIndexes.length ? rowIndexes : [rowIndex]
            })
        },
        onAddAbove ({rowIndex, rowIndexes}) {
            console.log('onAddAbove')
            this.addItems({
                panelIndex: this.index,
                itemNumber: rowIndexes.length || 1,
                addIndex: rowIndexes.length ? rowIndexes[0] : rowIndex
            })
        },
        onAddBelow ({rowIndex, rowIndexes}) {
            console.log('onAddBelow')
            this.addItems({
                panelIndex: this.index,
                itemNumber: rowIndexes.length || 1,
                addIndex: (rowIndexes.length ? rowIndexes[rowIndexes.length - 1] : rowIndex) + 1
            })
        },
        onReorder ({rows}) {
            console.log('onReorder')
            this.items = rows
            // this[UPDATE_AL_STORE]({
            //     path: `panels.${this.index}.items`,
            //     value: rows
            // })
        },
        addItems ({panelIndex, itemNumber, addIndex}) {
            console.log('addItems')
        // const panel = state.panels[panelIndex]
        // Generate blank items to add
        const newItems = _.range(itemNumber).map((item) => {
            return {
                id: _.uniqueId() * -1,
                cutpot: 'cut',
                family: '',
                variety: '',
                price: null,
                unit: '',
                grade: '',
                quantity: null,
                origin: '',
                color: '',
                note: '',
                $errors: {}
            }
        })

        const items = _.clone(panel.items)
        items.splice(_.isNumber(addIndex) ? addIndex : items.length, 0, ...newItems)
        // commit(types.UPDATE_AL_STORE, {[`panels[${panelIndex}].items`]: items})
        this.items = items
    },
        /**
         * @returns {Promise<boolean>}
         */
        async validate ({row, column, value}) {
            console.log('validate')
            // if (!column.rules) return true

            // const rowIndex = this.items.indexOf(row)
            // // Validate the value using its column's rules
            // return validate(value, column.rules, {name: this.$t(`columns.${column.name}`)})
            //     .then((result) => {
            //         const errorPath = `panels.${this.index}.items.${rowIndex}.$errors`

            //         // If there is error, update the error model
            //         this[UPDATE_AL_STORE]({
            //             path: errorPath,
            //             value: {
            //                 ...row.$errors,
            //                 [column.name]: result.valid ? null : result.errors
            //             }
            //         })
            //         return result.valid
            //     })
            return true
        },
        /**
         * @returns {Promise<boolean>}
         */
        validateAll () {
            /**
             * @type {Promise[]}
             */
            console.log('validateAll')
            // const validations = []
            // for (const column of this.columns) {
            //     for (const row of this.items) {
            //         // Only validate changed items
            //         if (row.id < 0 ||
            //             changeTracker.changedProps(row).filter(prop => !prop.startsWith('$')).length) {
            //             validations.push(this.validate({row, column, value: row[column.name]}))
            //         }
            //     }
            // }

            // return Promise.all(validations).then((results) => {
            //     return results.every(result => result)
            // })
            return true
        }
    }
}
</script>
<style scoped lang="sass">
    @import "~@/variables"
    .panel-items
        margin-top: 32px
        text-align: center

    .f-editable-table.items-table
        margin-left: -16px
        margin-bottom: 8px
        width: calc(100% + 32px)
        ::v-deep
            // Disable these border due to it's overlapping the sheet's border
            td:first-child, th:first-child
                border-left: none
            td:last-child, th:last-child
                border-right: none

            // Adjust widths of columns
            th.f-editable-table__header
                @mixin width ($width)
                    width: $width
                    min-width: $width
                &--row-number
                    @include width(36px)
                &--origin, &--family, &--variety
                    width: 33%
                &--cutpot
                    @include width(56px)
                &--color
                    @include width(88px)
                &--quantity
                    @include width(104px)
                &--unit
                    @include width(88px)
                &--grade
                    @include width(104px)
                &--price
                    @include width(88px)
                &--note
                    @include width(88px)
            td.f-editable-table__cell
                &--price, &--quantity
                    text-align: right
                    padding-right: 4px
            .cell-input
                &--price input, &--quantity input
                    text-align: right
                    padding-right: 4px
        .v-text-field
            margin-top: 0
            padding-top: 0
</style>