import _ from 'lodash'

export default class UserService {
    static getStatistics () {
        return JSON.parse(window.localStorage.getItem('user_statistics')) || {}
    }

    static setStatistics (stats) {
        window.localStorage.setItem('user_statistics', JSON.stringify(stats))
    }

    static saveCurrency (currency) {
        const userStats = UserService.getStatistics()
        _.set(userStats, `currency.${currency.toUpperCase()}`, Math.floor(Date.now() / 1000))
        // Keep only top 5 recents
        const currencyStats = userStats.currency
        if (_.size(currencyStats) === 6) {
            const minValue = _.min(_.values(currencyStats))
            userStats.currency = _.omitBy(currencyStats, (value) => {
                return value === minValue
            })
        }
        UserService.setStatistics(userStats)
    }

    static getDefaultCurrency () {
        const userStats = UserService.getStatistics()
        const currencyStats = _.get(userStats, 'currency') || {}
        let currency = 'USD'
        if (!_.isEmpty(currencyStats)) {
            const maxValue = _.max(_.values(currencyStats))
            currency = _.findKey(currencyStats, (prop) => {
                return prop === maxValue
            })
        }
        return currency
    }
}
