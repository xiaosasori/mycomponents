<template lang="pug">
    section
        v-btn.add-item-btn(outlined color="primary" @click="addItems({panelIndex: panelIndex, itemNumber: 1})")
            v-icon(left) mdi-plus
            | {{ $t('add_item') }}
        v-menu(offset-y v-model="addMultiShown" transition="slide-y-transition" :close-on-content-click="false")
            template(v-slot:activator="{ on }")
                v-btn.add-mult-item-btn(outlined color="primary" v-on="on" @click="addMultiShown = true")
                    v-icon mdi-chevron-down
            form(@submit.prevent="addMultiple")
                v-card.add-number-items-box
                    v-card-text.number-items-input
                        v-text-field(ref="input" outlined hide-details :label="$t('number_of_items')"
                            v-model.number="numberOfItems" type="number")
                    v-card-actions.add-items-btn
                        v-spacer
                        v-btn(outlined color="primary" type="submit")
                            | {{ $t('common.add') }}
</template>

<script>
    import {createNamespacedHelpers} from 'vuex'

    import {STORE_NS} from './constants'

    const {mapActions} = createNamespacedHelpers(STORE_NS)

    export default {
        props: {
            panelIndex: {
                type: Number,
                required: true
            }
        },
        data () {
            return {
                numberOfItems: null,
                addMultiShown: false
            }
        },
        watch: {
            addMultiShown (value) {
                if (value) {
                    const vm = this
                    ;(function pollUntilVisible () {
                        if (vm.$refs.input?.$el.getBoundingClientRect().width > 0) {
                            vm.$refs.input.focus()
                        } else {
                            requestAnimationFrame(pollUntilVisible)
                        }
                    })()
                }
            }
        },
        methods: {
            ...mapActions(['addItems']),
            addMultiple () {
                this.addMultiShown = false
                if (!this.numberOfItems) return

                this.addItems({panelIndex: this.panelIndex, itemNumber: this.numberOfItems})
                this.numberOfItems = null
            }
        }
    }
</script>

<style scoped lang="sass">
    .add-number-items-box
        width: 190px
    .add-items-btn
        padding: 0 8px 8px 0
    .number-items-input
        padding: 16px
        ::v-deep .v-input__slot input
            text-align: right
    .add-item-btn
        border-top-right-radius: 0px
        border-bottom-right-radius: 0px
    .add-mult-item-btn
        border-top-left-radius: 0px
        border-bottom-left-radius: 0px
        min-width: 35px !important
        width: 35px
        border-left: none
</style>

<i18n>
en:
    number_of_items: Number of items
</i18n>
