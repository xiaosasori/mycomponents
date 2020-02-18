import Vue, {VueConstructor, WatchOptions} from 'vue'

declare module 'vue/types/vue' {
    // Declare augmentation for Vue
    interface Vue {
        $watchOnce(
            expOrFn: string,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            callback: (this: this, n: any, o: any) => void,
            options?: WatchOptions
        ): void;
    }
}

export default class WatchOnceService {
    static install (Vue: VueConstructor): void {
        Object.defineProperty(Vue.prototype, '$watchOnce', {
            get () {
                // Create a wrapper function around $watch
                // to automatically unwatch after first trigger
                return (
                    exprOrFn: string,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    handler: (n: any, o: any) => void,
                    options?: WatchOptions
                ): void => {
                    const unwatch = (this as Vue).$watch(exprOrFn, (...args) => {
                        // If unwatch is available then call it
                        if (unwatch) {
                            unwatch()
                        } else {
                            // Otherwise wait until next tick, this happens with {immediate: true}
                            (this as Vue).$nextTick(() => unwatch())
                        }
                        return handler(...args)
                    }, options)
                }
            }
        })
    }
}
