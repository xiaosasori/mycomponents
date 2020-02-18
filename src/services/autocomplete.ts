import map from 'lodash/map'
import orderBy from 'lodash/orderBy'

import api from '@/services/api'
import currencies from '@/services/currencies.json'

interface Currency {
    id: string;
    code: string;
    name: string;
    countries: Array<string>;
}

export async function searchCurrencies (keyword: string): Promise<Array<Currency>> {
    const currenciesList = orderBy(map(currencies, (ccy, code) => ({...{id: code}, code, ...ccy})), ['code'], ['asc'])
    if (!keyword) return currenciesList

    const queryTextRegexp = new RegExp(keyword, 'i')

    return currenciesList.filter(({code, name, countries}) => {
        return queryTextRegexp.test(code) || queryTextRegexp.test(name) || countries.some(queryTextRegexp.test.bind(queryTextRegexp))
    })
}

interface Port {
    id: string;
    name: string;
}

export function searchPorts (keyword: string): Promise<Array<Port>> {
    const fields = 'id,name'
    return api.get('/api/ports', {
        params: {
            fields,
            keyword
        }
    }).then(({data}) => (data as Array<Port>))
}

const CONTINENTS = [
    'Africa', 'Antarctica', 'Asia', 'Europe',
    'Oceania', 'North America', 'South America'
]

interface Country {
    id: string;
    name: string;
}

export function searchCountries (keyword: string): Promise<Array<Country>> {
    const fields = 'id,name'

    return api.get('/api/countries', {params: {fields, keyword}})
        .then(({data}) => (data as Array<Country>))
}

interface Location {
    id: string;
    name: string;
}

export async function searchLocations (keyword: string): Promise<Array<Location>> {
    const filteredContinents = CONTINENTS
        .filter(continent => continent.toLowerCase().includes(keyword.toLowerCase()))
        .map(continent => ({id: continent, name: continent}))
    const countries = await searchCountries(keyword)

    return [...filteredContinents, ...countries]
}

interface Account {
    id: string;
    name: string;
}

export function searchVendors (keyword: string, extraParams?: Record<string, string>): Promise<Array<Account>> {
    const params = {
        fields: 'id,name',
        name: keyword,
        // eslint-disable-next-line @typescript-eslint/camelcase
        per_page: '100',
        ...extraParams
    }
    return api.get('/api/vendors', {params})
        .then(({data}) => (data as Array<Account>))
}

export function searchShippableMerchants (keyword, extraParams?: Record<string, string>): Promise<Array<Account>> {
    const params = {
        fields: 'id,name',
        name: keyword,
        // eslint-disable-next-line @typescript-eslint/camelcase
        shippable_only: 'true',
        // eslint-disable-next-line @typescript-eslint/camelcase
        per_page: '100',
        ...extraParams
    }
    return api.get('/api/merchants', {params})
        .then(({data}) => (data as Array<Account>))
}

interface Product {
    id: string;
    name: string;
}

export function searchProducts (name, extraParams?: Record<string, string>): Promise<Array<Product>> {
    const params = {
        fields: 'id,name,origin,cutpot',
        name: name,
        ...extraParams
    }
    return api.get('/api/products', {params}).then(({data}) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (data as Array<any>).map(({id, name, origin, cutpot}) => {
            return {
                id,
                name: `[${cutpot}] ${name}${origin ? ` - ${origin}` : ''}`
            }
        })
    })
}
