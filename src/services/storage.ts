import {CookieStorage} from 'cookie-storage'

// Init CookieStorage as fallback if localStorage was disabled
let storage: Storage = new CookieStorage()
try {
    // If localStorage is disabled, next clause will throw error
    window.localStorage.setItem('_test', '1')
    storage = window.localStorage
    window.localStorage.removeItem('_test')
} catch (e) {
    // Ignore
}

export const cookieStorage = new CookieStorage()

export default storage
