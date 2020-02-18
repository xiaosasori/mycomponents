import Vue from 'vue'
import VueI18n from 'vue-i18n'

export const dialogEventBus = new Vue()

interface ErrorDialogOptions {
    okText?: string | VueI18n.TranslateResult;
    okTextColor?: string | VueI18n.TranslateResult;
    persistent?: boolean | VueI18n.TranslateResult;
}

interface ConfirmDialogOptions extends ErrorDialogOptions {
    cancelText?: string;
}

export const dialog = {
    error: function (message: string | Error | Response, options?: ErrorDialogOptions): Promise<void> {
        return new Promise((resolve): void => {
            dialogEventBus.$emit('add', {
                message, ...options, onAccept: resolve, onReject: resolve, type: 'error'
            })
        })
    },
    confirm: function (message: string, options?: ConfirmDialogOptions): Promise<boolean> {
        return new Promise((resolve, reject): void => {
            dialogEventBus.$emit('add', {
                message, ...options, onAccept: resolve, onReject: reject, type: 'confirm'
            })
        })
    }
}

declare module 'vue/types/vue' {
  // 3. Declare augmentation for Vue
  interface Vue {
    $dialog: typeof dialog;
  }
}

export default class DialogService {
    static install (Vue): void {
        Object.defineProperty(Vue.prototype, '$dialog', {
            get () {
                return dialog
            }
        })
    }
}
