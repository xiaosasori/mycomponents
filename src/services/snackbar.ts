import Vue from 'vue'
import {RawLocation} from 'vue-router'

export const snackbarEventBus = new Vue()

interface SnackbarButton {
    /**
     * The text of the button
     */
    text: string;
    /**
     * Where to go if this button is clicked using vue-router
     */
    to?: RawLocation;
    /**
     * Where to go if this button is clicked by rendering a link
     * with provided href.
     */
    href?: string;
    /**
     * Text color of the button. Default: green
     */
    color?: string;
    /**
     * Callback after clicked on the button
     */
    onClick?: Function;
}

interface SnackbarOptions {
    // Show snackbar at right side of the screen
    right?: boolean;
    // Show snackbar at bottom side of the screen
    bottom?: boolean;
    // Show snackbar at left side of the screen
    left?: boolean;
    // Show snackbar at top side of the screen
    top?: boolean;
    /**
     * Extra buttons to display alongside with the default "Dismiss" button
     */
    extraButtons?: Array<SnackbarButton>;
}

export const snackbar = {
    // Dynamically render snackbar into DOM
    show: function (
        message: string, {
            right = true,
            bottom = true,
            left = false,
            top = false,
            extraButtons = []
        }: SnackbarOptions = {},
        timeout = 3000
    ): void {
        snackbarEventBus.$emit('add', {message, right, bottom, left, top, extraButtons, timeout})
    }
}

declare module 'vue/types/vue' {
  // 3. Declare augmentation for Vue
  interface Vue {
    $snackbar: typeof snackbar;
  }
}

export default class SnackbarService {
    static install (Vue): void {
        Object.defineProperty(Vue.prototype, '$snackbar', {
            get () {
                return snackbar
            }
        })
    }
}
