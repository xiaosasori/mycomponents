/* eslint-disable no-param-reassign */
import {getCurrentApp} from '../bootstrap'
import {auth} from './auth'
import {dialog} from './dialog'

interface ApiOptions extends RequestInit {
    /**
     * Query string parameters to add to URL
     */
    params: Record<string, string>;
}

interface NormalizedApiOptions extends ApiOptions {
    headers: Headers;
}

interface InterceptorParams {
    url: string;
    options: NormalizedApiOptions;
}

interface FmiResponse extends Response {
    data?: object | Array<object>;
}

type RequestInterceptor = (params: InterceptorParams) => Promise<InterceptorParams>
type ResponseInterceptor = (response: FmiResponse) => Promise<FmiResponse>

class Api {
    requestInterceptors: Array<RequestInterceptor> = [];

    responseInterceptors: Array<ResponseInterceptor> = [];

    errorResponseInterceptors: Array<ResponseInterceptor> = [];

    async request (url: string, options?: ApiOptions): Promise<FmiResponse> {
        let normalizedOptions: NormalizedApiOptions = {
            ...options,
            // Ensure headers is a Headers object
            headers: new Headers(options.headers)
        }

        // Normalize URL
        if (normalizedOptions.params) {
            // Construct an URL object
            const _url = new URL(url, window.location.origin)

            // Remove undefined/null parameters from query
            const params = normalizedOptions.params
            Object.keys(params).forEach((key) => (params[key] == null) && delete params[key])

            // Add query string to URL
            _url.search = (new URLSearchParams(normalizedOptions.params)).toString()
            url = _url.toString()
        }

        // Execute request interceptors
        for (const requestInterceptor of this.requestInterceptors) {
            // eslint-disable-next-line no-param-reassign
            ({url, options: normalizedOptions} =
                await requestInterceptor({url, options: normalizedOptions}))
        }

        // Execute request
        let result: Promise<FmiResponse> = fetch(url, normalizedOptions)

        // Execute response interceptors
        for (const responseInterceptor of this.responseInterceptors) {
            result = result.then(responseInterceptor)
        }

        // Execute error response interceptors
        for (const responseInterceptor of this.errorResponseInterceptors) {
            result = result.catch(responseInterceptor)
        }

        // Finally return the result
        return result
    }

    get (url: string, options?: ApiOptions): Promise<FmiResponse> {
        return this.request(url, {...options, method: 'GET'})
    }

    post (url: string, data: BodyInit, options?: ApiOptions): Promise<FmiResponse> {
        return this.request(url, {...options, body: data, method: 'POST'})
    }

    put (url: string, data: BodyInit, options?: ApiOptions): Promise<FmiResponse> {
        return this.request(url, {...options, body: data, method: 'PUT'})
    }

    patch (url: string, data: BodyInit, options?: ApiOptions): Promise<FmiResponse> {
        return this.request(url, {...options, body: data, method: 'PATCH'})
    }

    delete (url: string, options?: ApiOptions): Promise<FmiResponse> {
        return this.request(url, {...options, method: 'DELETE'})
    }
}

const api = new Api()

// Auto add authorization header
api.requestInterceptors.push(async function ({url, options}) {
    const token: string = await auth.handleAuthentication().catch((err) => console.error(err))
    if (token) {
        options.headers.set('Authorization', `Bearer ${token}`)
    }
    return {url, options}
})

// Auto convert json data before sending
api.requestInterceptors.push(async function ({url, options}) {
    if (!['undefined', 'string'].includes(typeof options.body) &&
            !(options.body instanceof FormData)) {
        options.body = JSON.stringify(options.body)
        options.headers.set('Content-Type', 'application/json')
    }
    return {url, options}
})

// Auto convert json data after receiving
api.responseInterceptors.push(async function (response: FmiResponse) {
    // check PDF file
    const contentType = response.headers.get('Content-Type')
    if (contentType === 'application/pdf') {
        return response
    }

    response.data = await response.text().then((text) => {
        if (!text) return text
        try {
            return JSON.parse(text)
        } catch (e) {
            /* istanbul ignore next */
            return text
        }
    })
    return response
})

// Throw error on non-ok status
api.responseInterceptors.push(async function (response) {
    if (!response.ok) {
        throw response
    }
    return response
})

// Show logout confirmation dialog then logout
api.errorResponseInterceptors.push(async function (response) {
    const app = getCurrentApp()
    const pathIgnored = app.$route.path.includes('verify-new-email')
    if (response.status === 401 && !pathIgnored) {
        await dialog.error(
            app.$t('errors.login_expired') as string,
            {
                okText: app.$t('common.login'),
                persistent: true
            }
        )
        auth.logout()
        window.location.reload()
    }
    throw response
})

export default api
