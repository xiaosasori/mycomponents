<template lang="pug">
    v-menu.f-help(v-model="helpShown"
            :class="{'f-help--shown': helpShown}"
            offset-y :nudge-top="5" :nudge-left="8"
            :close-on-content-click="false" :close-on-click="false"
            content-class="f-help__content" top)
        template(v-slot:activator="{on}")
            v-icon.f-help__icon(v-on="on" size="16") mdi-information
        v-card
            v-btn.close-btn(icon @click="helpShown = false")
                v-icon mdi-close
            slot(name="card")
                v-card-text.pr-7
                    .text--primary
                        slot
</template>

<script>
    import Vue from 'vue'
    const $bus = new Vue()
    const SHOWN_EVENT = 'fhelp.shown'

    export default {
        data () {
            return {
                helpShown: false
            }
        },
        watch: {
            helpShown (value) {
                value && $bus.$emit(SHOWN_EVENT, this)
            }
        },
        beforeMount () {
            // When any f-help shows up, all other f-help should hide
            $bus.$on(SHOWN_EVENT, ($instance) => {
                if ($instance !== this) {
                    this.helpShown = false
                }
            })
        }
    }
</script>

<style lang="sass" scoped>
    @import '~vuetify/src/styles/styles'
    .close-btn
        position: absolute
        top: 3px
        right: 3px
        height: 20px !important
        width: 20px !important
        .v-icon
            height: 17px !important
            width: 17px !important
            margin: 0 !important
    .v-icon--svg
        height: .7em
        width: .7em
        margin-bottom: 4px
        margin-left: 2px
        opacity: .51
    // The arrow under the help block
    .f-help
        position: relative
        &:after
            content: ''
            display: block
            position: absolute
            z-index: 8
            opacity: 0
            top: -22px
            left: 5px
            width: 10px
            height: 10px
            background: #FFFFFF
            border-right: 1px solid map-get($light-green, lighten-2)
            border-bottom: 1px solid map-get($light-green, lighten-2)
            transform: rotate(45deg)
            transition: opacity .3s map-get($transition, 'fast-in-fast-out')
            pointer-events: none
        &--shown:after
            opacity: 1
</style>

<style lang="sass">
    @import '~vuetify/src/styles/styles'

    .f-help__content
        border: 1px solid map_get($light-green, lighten-2)
        border-radius: 4px
        box-shadow: none
</style>
