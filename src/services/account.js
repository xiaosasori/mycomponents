import {ref} from '@vue/composition-api'

import api from '@/services/api'

class AccountService {
    fetchDataPromise = null

    constructor () {
        this.timezone = ref(null)
    }

    async get () {
        if (!this.fetchDataPromise) {
            this.fetchDataPromise = api.get('/api/accounts/self').then(({data}) => {
                this.timezone.value = data.timezone
                return data
            })
        }
        return this.fetchDataPromise
    }
}
const account = new AccountService()

export default account
