import auth0 from 'auth0-js'
import EventEmitter from 'EventEmitter'
import jwtDecode from 'jwt-decode'

import storage from './storage'
export const AUTH_STORE_NS = '$authStore'
export const STT_NO_TOKEN = 'no token'
export const STT_VALID = 'valid'
export const STT_EXPIRED = 'expired'

export default class AuthService {
    auth0 = new auth0.WebAuth({
        domain: process.env.AUTH_ENDPOINT,
        clientID: process.env.APP_CLIENTID,
        redirectUri: `${window.location.origin}/callback`,
        audience: process.env.API_AUDIENCE,
        responseType: 'token id_token',
        scope: 'openid profile email'
    })

    authNotifier = new EventEmitter()

    $store = null

    init (store) {
        // Register a store in vuex
        store.registerModule(AUTH_STORE_NS, {
            namespaced: true,
            state: {
                userInfo: {},
                isAuthenticated: false
            },
            mutations: {
                update (state, payload) {
                    for (const key in payload) {
                        if (!Object.prototype.hasOwnProperty.call(payload, key)) continue
                        state[key] = payload[key]
                    }
                }
            }
        })
        this.$store = store
        this.updateStore({
            userInfo: JSON.parse(storage.getItem('user_info')),
            isAuthenticated: this.isAuthenticated(false)
        })
    }

    login (extraParams = {}) {
        const nonce = this._generateNonce()
        storage.setItem('nonce', nonce)
        storage.setItem(nonce, JSON.stringify({referer: extraParams.referer}))
        // eslint-disable-next-line no-param-reassign
        delete extraParams.referer
        this.auth0.authorize({...extraParams, nonce, connection: process.env.AUTH0_CONNECTION})
    }

    signup (extraParams = {}) {
        this.auth0.authorize({...extraParams, connection: process.env.AUTH0_CONNECTION, mode: 'signUp'})
    }

    handleLoginCallback () {
        const nonce = storage.getItem('nonce')
        this.auth0.parseHash({nonce}, (err, authResult) => {
            if (authResult && authResult.accessToken && authResult.idToken) {
                const decoded = jwtDecode(authResult.idToken)
                this.setSession(authResult, decoded)
            } else {
                this.authNotifier.emit('loginError', err)
            }
        })
    }

    setSession (authResult, user) {
        // Set the time that the Access Token will expire at
        const expiresAt = JSON.stringify(
            authResult.expiresIn * 1000 + new Date().getTime()
        )
        storage.setItem('access_token', authResult.accessToken)
        storage.setItem('id_token', authResult.idToken)
        storage.setItem('scope', authResult.scope)
        storage.setItem('expires_at', expiresAt)
        storage.setItem('user_info', JSON.stringify(user))

        // Update $store
        this.updateStore({userInfo: user})

        // Local storage seems to be asynchronous so we will need to poll until values are saved before emiting
        // authentication change
        const auth = this
        ;(function pollStorage () {
            if (!storage.getItem('expires_at')) { return setTimeout(pollStorage, 16) }
            auth.authNotifier.emit('authChange', {
                authenticated: auth.isAuthenticated()
            })
        })()
    }

    logout (returnTo = null) {
        // Clear Access Token and ID Token from local storage
        storage.removeItem('access_token')
        storage.removeItem('id_token')
        storage.removeItem('scope')
        storage.removeItem('expires_at')
        storage.removeItem('user_info')

        // Reset $store
        this.updateStore({
            userInfo: {},
            isAuthenticated: false
        })

        this.authNotifier.emit('authChange', false)

        // Clear SSO cookie to clear Auth0 session
        if (returnTo) {
            const logoutUrl = `https://${process.env.AUTH_ENDPOINT}/v2/logout`
            window.location.href = `${logoutUrl}?client_id=${process.env.APP_CLIENTID}&returnTo=${encodeURI(returnTo)}`
        }
    }

    isAuthenticated (updateStore = true) {
        const authStatus = this.getAuthStatus()
        let isAuthenticated = true

        if (~[STT_NO_TOKEN, STT_EXPIRED].indexOf(authStatus)) {
            isAuthenticated = false
        }

        // Update store
        if (updateStore) {
            this.updateStore({isAuthenticated})
        }

        return isAuthenticated
    }

    getAuthStatus () {
        if (this.getCurrentToken()) {
            // Check whether the current time is past the
            // Access Token's expiry time
            const expiresAt = JSON.parse(storage.getItem('expires_at'))
            const isExpired = new Date().getTime() >= expiresAt

            if (isExpired) {
                return STT_EXPIRED
            } else {
                return STT_VALID
            }
        } else {
            return STT_NO_TOKEN
        }
    }

    /**
     * @returns {string}
     */
    getCurrentToken () {
        return storage.getItem('access_token')
    }

    renewToken () {
        return new Promise((resolve, reject) => {
            this.auth0.checkSession({}, (err, authResult) => {
                if (authResult && authResult.accessToken && authResult.idToken) {
                    const decoded = jwtDecode(authResult.idToken)
                    this.setSession(authResult, decoded)
                    resolve(authResult.accessToken)
                } else {
                    reject(err)
                }
            })
        })
    }

    handleAuthentication () {
        switch (this.getAuthStatus()) {
        case STT_VALID:
            return Promise.resolve(this.getCurrentToken())
        case STT_NO_TOKEN:
            return Promise.reject(new Error('No token'))
        case STT_EXPIRED:
            if (!this._renewTokenPromise) {
                this._renewTokenPromise = this.renewToken().finally(() => {
                    delete this._renewTokenPromise
                })
            }
            return this._renewTokenPromise
        }
    }

    updateStore (payload) {
        this.$store.commit(`${AUTH_STORE_NS}/update`, payload)
    }

    /** Copied from auth0-js/src/helper/random.js */
    _generateNonce () {
        // eslint-disable-next-line
        const length = 32;
        const bytes = new Uint8Array(length)
        const result = []
        const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._~'

        const cryptoObj = window.crypto || window.msCrypto
        if (!cryptoObj) {
            return null
        }

        const random = cryptoObj.getRandomValues(bytes)

        for (let a = 0; a < random.length; a++) {
            result.push(charset[random[a] % charset.length])
        }

        return result.join('')
    }

    static install (Vue) {
        Object.defineProperty(Vue.prototype, '$auth', {
            get () {
                return auth
            }
        })
    }
}

export const auth = new AuthService()
