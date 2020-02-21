<template lang="pug">
    v-combobox.f-autocomplete(
        ref="combobox"
        v-bind="{autoSelectFirst: true, hideDetails: true, appendIcon: '', noFilter: true, autocomplete: 'off',\
            ...$attrs, \
            items: items, loading: loading, \
            $scopedSlots}"
        v-on="{...$listeners, 'update:search-input': onUpdateSearchInput, focus: onFocus, \
            input: onInput}")
        template(v-for="(_, name) in $slots" :slot="name")
            slot(:name="name")
</template>

<script>
    /**
     * @component FAutocomplete
     *
     * Simple usage:
     * ```html
     *     <f-autocomplete v-model="value" :resolver="search"></f-autocomplete>
     * ```
     * ```js
     * export default {
     *     data () {
     *         value: 'some value'
     *     },
     *     methods: {
     *         async search (keyword) {
     *             return await this.$http.get('/api/endpoint', {params: {keyword}})
     *         }
     *     }
     * }
     * ```
     *
     * Advanced usage: See https://vuetifyjs.com/en/components/combobox for full list of props
     */
    import _ from 'lodash'

    export default {
        props: {
            /**
             * A function which will receive the current keyword and should resolve the
             * results of autocomplete for that keyword
             */
            resolver: {type: Function, required: true},
            /**
             * Additional data that you want to pass to the resolver as second argument
             */
            resolverParams: {type: Object, default: () => ({})},
            searchOnFocus: {type: Boolean, default: false},
            searchOnEmptyInput: {type: Boolean, default: true}
        },
        data () {
            return {
                items: [],
                loading: false,
                currentSearch: null
            }
        },
        computed: {
            isFocused () { return this.$refs.combobox && this.$refs.combobox.isFocused }
        },
        methods: {
            doSearch: _.debounce(function () {
                // Get the current value to search
                // Due to debounce, there may be case where the component was destroyed before
                // this function is called. In that case, combobox will not exist
                /*
                const val = this.$refs.combobox?.internalSearch

                // If the internal search was cleared, quit
                if (val === null) return

                // If the internal search is empty, but we do not allow searching on empty, quit
                if (val === '' && !this.searchOnEmptyInput) return

                // Create a new search session
                this.loading = true

                const currentSearch = this.resolver(val, this.resolverParams).finally(() => {
                    // Ignore the result if there exists a newer search session
                    if (currentSearch !== this.currentSearch) return

                    this.loading = false
                }).then(items => {
                    // Ignore the result if there exists a newer search session
                    if (currentSearch !== this.currentSearch) return

                    // Store the result
                    this.items = items
                })
                */
                // Store current search promise
                this.currentSearch = 'hello'
            }, 300),
            async onUpdateSearchInput (value) {
                console.log('asda', this.$refs.combobox)
                // When search input is updated, only start search when component is in focused
                // if (this.$refs.combobox.isFocused) this.doSearch()

                // In case the input is not of multiple type, we also need to emit input event
                // immediately
                // The null value indicates that this is a clear-search-input event, and we don't
                // want to use it to update our input
                if (!(this.$attrs.multiple || this.$attrs.multiple === '') && value !== null) {
                    this.$emit('input', value)
                }

                // Bubble up this event
                this.$emit('update:search-input', value)
            },
            onFocus (event) {
                if (this.searchOnFocus) this.doSearch()
                this.$emit('focus', event)
            },
            onInput (event) {
                // Clear current seach input if we are in multiple select mode
                if (this.$attrs.multiple || this.$attrs.multiple === '') {
                    this.$refs.combobox.internalSearch = ''
                    this.items = []
                }
                this.$emit('input', event)
            }
        }
    }
</script>
