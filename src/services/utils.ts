import {computed, getCurrentInstance} from '@vue/composition-api'
import dayjs from 'dayjs'
import cloneDeep from 'lodash/cloneDeep'
import forOwn from 'lodash/forOwn'
import isEqual from 'lodash/isEqual'
import omit from 'lodash/omit'
import pick from 'lodash/pick'
import template from 'lodash/template'
import {DateTime, IANAZone} from 'luxon'
import parse from 'parse-link-header'
import {ValidationProvider} from 'vee-validate'
import {
    FunctionalComponentOptions,
    VNode,
    VueConstructor
} from 'vue'
// eslint-disable-next-line import/extensions
import {AsyncComponentFactory, AsyncComponentPromise} from 'vue/types/options'
import VProgressCircular from 'vuetify/lib/components/VProgressCircular'
import {
    ActionMethod,
    Computed,
    createNamespacedHelpers,
    MutationMethod
} from 'vuex'
import {updateField as _updateField} from 'vuex-map-fields'
import arrayToObject from 'vuex-map-fields/src/lib/array-to-object'

interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    perPage?: number;
}
export function convertLinkHeaderToPagination (linkHeader: string): PaginationInfo {
    const parsedLink = parse(linkHeader)
    let currentPage: number, totalPages: number, perPage: number

    // Get current page from next or prev link, whichever is available
    if (parsedLink.next) {
        currentPage = parseInt(parsedLink.next.page) - 1
        perPage = parseInt(parsedLink.next.per_page)
    } else if (parsedLink.prev) {
        currentPage = (parseInt(parsedLink.prev.page) || 1) + 1
        perPage = parseInt(parsedLink.prev.per_page)
    }

    // Get total pages from last link or prev link, whichever is available
    if (parsedLink.last) {
        totalPages = parseInt(parsedLink.last.page)
        perPage = parseInt(parsedLink.last.per_page)
    } else if (parsedLink.prev) {
        totalPages = (parseInt(parsedLink.prev.page) || 1) + 1
        perPage = parseInt(parsedLink.prev.per_page)
    }

    return {currentPage, totalPages, ...(perPage ? {perPage} : {})}
}

export function updateFieldFactory (path: string) {
    return function (state, value): void {
        return _updateField(state, {path, value})
    }
}

export function updateFieldsFactory (prefix = '') {
    return function (state, payload): void {
        forOwn(payload, (value, key) => {
            const path = prefix ? `${prefix}.${key}` : key
            _updateField(state, {path, value})
        })
    }
}

/**
 * Only resolve a promise after at least an amount of time
 *
 * Useful for when showing a progress indicator for a request but don't
 * want the indicator to be back to hidden too fast
 */
export async function delayPromise<T> (time: number, promise: Promise<T>): Promise<T> {
    await Promise.all([
        promise,
        new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, time))
    ])
    return promise
}

/**
 * Better named, function alias of delayPromise
 */
export function avoidTooFastAnimation<T> (promise: Promise<T>, time = 1500): Promise<T> {
    return delayPromise(time, promise)
}

class ChangeTracker {
    _store: WeakMap<object, object>

    constructor () {
        this._store = new WeakMap()
    }

    track (object: object): void {
        // Clone the object
        const clone = cloneDeep(object)
        // Store it
        this._store.set(object, clone)
    }

    getOriginal (object: object): object {
        // Access everything so if this function is used inside a
        // computed property, Vue will refresh the computed value
        // when object changes
        for (const prop in object) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const __ = object[prop]
        }
        return this._store.get(object)
    }

    changedProps (object): Array<string> {
        const clone = this.getOriginal(object)
        if (clone === undefined) {
            throw new Error('This object was not tracked. Call objectTracker.track(object) first.')
        }
        const props = []
        for (const prop in object) {
            if (!isEqual(object[prop], clone[prop])) {
                props.push(prop)
            }
        }
        return props
    }

    changed (object: object): object {
        return pick(object, this.changedProps(object))
    }

    /**
     * Mark a property as unchanged by copying value back to original object
     */
    setUnchanged (object: object, prop: string): void {
        const original = this.getOriginal(object)
        original[prop] = object[prop]
    }
}

export const changeTracker = new ChangeTracker()

export function utcISOToLocalDate (utc): string {
    // Convert ISO8601 UTC(server format) to local timezone
    const parsed = dayjs(utc)
    if (parsed.isValid()) {
        return parsed.format('YYYY-MM-DD')
    } else {
        return ''
    }
}

export function toTimezone (datetime, timezone): string {
    const dt = DateTime.fromISO(datetime)
    if (!(dt.isValid && IANAZone.isValidZone(timezone))) return
    return dt.setZone(timezone)
        .setZone('local', {keepLocalTime: true})
        .toJSDate()
}

/**
 * Convert local datetime to datetime with timezone
 *
 * E.g:
 * 2020-01-01T00:00.00.000 -> 2020-01-01T00:00:00.000+07:00 (with timezone: +07:00)
 * 2020-01-01 -> 2020-01-01T00:00:00.000+07:00 (with timezone: +07:00)
 *
 */
export function localDateToTimeZoneString (localTime, timezone): string {
    const dt = DateTime.fromISO(localTime)
    if (!(dt.isValid && IANAZone.isValidZone(timezone))) return
    const dateTz = DateTime.fromISO(localTime, {zone: timezone})
    return dateTz.toString()
}

/**
 * Convert datetime with timezone to short version without timezone
 * @param: datetime: original datetime
 * @param: timezone: local timezone that we want convert to
 * @return converted date time string
 *
 * E.g:
 * 2020-01-02T23:59:59.999+07:00 -> 2020-01-03 (in timezone: +09:00)
 *
 */
export function timezoneStringToLocalDateString (datetime, timezone): string {
    const dt = DateTime.fromISO(datetime, {zone: timezone})
    if (!(dt.isValid)) return
    return dt.toISODate()
}

/**
 * An modified version of mapFields from vuex-map-fields that allow
 * specifying a part of the key as dynamic, using template string syntax.
 * The context for evaluation will be the Vue instance.
 *
 * E.g:
 * export default {
 *     props: {
 *         index: {type: Number}
 *     },
 *     computed: {
 *         ...mapDynamicFields(namespace, ['panels.${index}.title'])
 *     }
 * }
 *
 * @param namespace
 * @param fields
 * @returns {{}}
 */
export function mapDynamicFields (namespace: string, fields): Dictionary<Computed> {
    const fieldsObject = arrayToObject(fields)

    return Object.keys(fieldsObject).reduce((prev, key) => {
        const path = template(fieldsObject[key])

        // eslint-disable-next-line no-param-reassign
        prev[key] = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            get (): any {
                return this.$store.getters[`${namespace}/getField`](path(this))
            },
            set (value): void {
                this.$store.commit(`${namespace}/updateField`, {path: path(this), value})
            }
        }

        return prev
    }, {})
}

/**
 * A modified version of updateField from vuex-map-fields that allow updating multiple
 * keys at once.
 * @param state The Vuex state
 * @param payload
 */
export function updateField (state, payload): void {
    if (payload.path !== undefined && payload.value !== undefined) {
        _updateField(state, payload)
    } else {
        Object.keys(payload).forEach(path => {
            const value = payload[path]
            _updateField(state, {path, value})
        })
    }
}

// Re-export getField in this file for convenience when importing
export {getField} from 'vuex-map-fields'

/**
 * Utility function to support lazy loading route component with nice loading indicator when
 * the component is taking some time to load
 */
export function loadRoute (AsyncView: AsyncComponentPromise): Promise<FunctionalComponentOptions> {
    const AsyncHandler: AsyncComponentFactory = () => ({
        component: AsyncView,
        loading: {
            functional: true,
            render (h) {
                return h(VProgressCircular, {
                    class: 'mx-auto mt-12 d-block',
                    props: {color: 'grey', size: '64', indeterminate: true}
                })
            }
        } as FunctionalComponentOptions
    })

    return Promise.resolve({
        functional: true,
        render (h, {data, children}) {
            // Transparently pass any props or children
            // to the view component.
            return h(AsyncHandler, data, children)
        }
    } as FunctionalComponentOptions)
}

/**
 * Wrap an VInput (e.g: VTextField, VSelect) with validation provider
 * @param VInputComponent
 */
export function wrapValidation (VInputComponent: VueConstructor): FunctionalComponentOptions {
    const PROVIDER_PROPS = ['vid', 'name', 'rules']

    return {
        functional: true,
        render (h, ctx): VNode {
            return h(ValidationProvider, {
                props: {
                    name: ctx.data.attrs.label,
                    ...pick(ctx.data.attrs, PROVIDER_PROPS),
                    slim: true
                },
                scopedSlots: {
                    default ({errors}): VNode {
                        return h(VInputComponent, {
                            ...ctx.data,
                            attrs: {
                                ...omit(ctx.data.attrs, PROVIDER_PROPS),
                                'error-messages': errors
                            }
                        })
                    }
                }
            })
        }
    }
}

type Dictionary<T> = { [key: string]: T }

export function useState (namespace, mapper): Dictionary<Computed> {
    const {mapState} = createNamespacedHelpers(namespace)
    const states = mapState(mapper)
    const boundStates = {}
    const currentVm = getCurrentInstance()

    for (const key in states) {
        // noinspection JSUnfilteredForInLoop
        boundStates[key] = computed(
            () => states[key].bind(currentVm)()
        )
    }

    return boundStates
}

export function useGetters (namespace, mapper): Dictionary<Computed> {
    const {mapGetters} = createNamespacedHelpers(namespace)
    const getters = mapGetters(mapper)
    const boundGetters = {}
    const currentVm = getCurrentInstance()

    for (const key in getters) {
        // noinspection JSUnfilteredForInLoop
        boundGetters[key] = computed(
            () => getters[key].bind(currentVm)()
        )
    }

    return boundGetters
}

export function useMutations (namespace, mapper): Dictionary<MutationMethod> {
    const {mapMutations} = createNamespacedHelpers(namespace)
    const mutations = mapMutations(mapper)
    const boundMutations = {}
    const currentVm = getCurrentInstance()

    for (const key in mutations) {
        // noinspection JSUnfilteredForInLoop
        boundMutations[key] = mutations[key].bind(currentVm)
    }

    return boundMutations
}

export function useActions (namespace, mapper): Dictionary<ActionMethod> {
    const {mapActions} = createNamespacedHelpers(namespace)
    const actions = mapActions(mapper)
    const boundActions = {}
    const currentVm = getCurrentInstance()

    for (const key in actions) {
        // noinspection JSUnfilteredForInLoop
        boundActions[key] = actions[key].bind(currentVm)
    }

    return boundActions
}

export function isIE (): boolean {
    const ua = window.navigator.userAgent
    const msie = ua.indexOf('MSIE ')
    return msie > 0 || !!navigator.userAgent.match(/Trident.*rv:11./)
}

type PastedItems = Array<Array<string>>

export function getCsvFromClipboardData (clipboardData: DataTransfer): PastedItems {
    let pastedText: string
    let isHTML = true
    let pastedItems: PastedItems = []

    try {
        pastedText = clipboardData.getData('text/html')
        if (!pastedText) {
            pastedText = clipboardData.getData('text/plain')
            isHTML = false
        }
    } catch (e) {
        pastedText = clipboardData.getData('text')
        isHTML = false
    }
    pastedText = pastedText.trim()

    if (isHTML) {
        const parser = new DOMParser()
        const trList = parser.parseFromString(pastedText, 'text/html').querySelectorAll('tr')
        pastedItems = Array.from(trList).map(function (tr) {
            return Array.from(tr.querySelectorAll('td')).map(function (td: HTMLElement) {
                return td.innerText
            })
        })
    } else {
        pastedItems = pastedText.split('\n').map(function (row) {
            return row.split('\t')
        })
    }

    return pastedItems
}
