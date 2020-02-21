import _ from 'lodash'

// import api from '@/common/services/api'
// import {RETURN_REP} from '@/common/services/const'
// import UserService from '@/common/services/user'
import {changeTracker, getField, updateField} from '@/services/utils'
// import {PANEL_PROPS} from '@/vendor/components/AL/constants'
import * as types from '../mutation-types'

const namespaced = true

const defaultShowColumns = [
    'type', 'origin', 'family', 'variety', 'color', 'note',
    'unit', 'grade', 'price', 'quantity']

    const state = {
      al: {
          title: '',
          introduction: '',
          available_from: '',
          available_until: '',
          image: null,
          currency: '',
          minimum_order_amount: 0
      },
      panels: [],
      panelFiles: [],
      publish: {
          title: '',
          destinations: []
      },
      selected: {}
  }

const getters = {
  getField
}

const mutations = {
    [types.UPDATE_AL_STORE]: updateField
}

const actions = {
  trackAlData ({state}) {
      changeTracker.track(state.al)
  },
  generateNewAl ({commit, dispatch}) {
      commit(types.UPDATE_AL_STORE, {
          path: 'al',
          value: {
              title: '',
              introduction: '',
              available_from: '',
              available_until: '',
              currency: '',
              id: null,
              image: null,
              minimum_order_amount: 0
          }
      })
      commit(types.UPDATE_AL_STORE, {
          path: 'panels',
          value: []
      })
      dispatch('trackAlData')
      // Set default al title
      commit(types.UPDATE_AL_STORE, {path: 'al.title', value: 'Untitled Availability List'})
      // Set default currency
      commit(types.UPDATE_AL_STORE, {path: 'al.currency', value: UserService.getDefaultCurrency()})
  },
  createAl ({state, commit, dispatch}) {
      const params = changeTracker.changed(state.al)
      const image = params.image
      delete params.image

      return api.post('/api/availabilitylists', params).then(async function ({data: {id}}) {
          if (!image) return id

          await dispatch('uploadAlImage', {alId: id, image})

          return id
      })
  },

  async updateAl ({state, commit, dispatch}) {
      const params = changeTracker.changed(state.al)

      if (_.isEmpty(params)) {
          return false
      }

      // Force sending both from and until if one of them change
      if (params.available_from || params.available_until) {
          params.available_from = state.al.available_from
          params.available_until = state.al.available_until
      }

      let image
      // If there is a new image
      if ('image' in params && params.image) {
          image = params.image
          // Delete current image first if there was one
          if (changeTracker.getOriginal(state.al).image) {
              params.image = null
          } else {
              delete params.image
          }
      }

      if (!_.isEmpty(params)) {
          await api.patch(`/api/availabilitylists/${state.al.id}`, params)
      }

      if (image) {
          await dispatch('uploadAlImage', {alId: state.al.id, image})
      }
  },
  uploadAlImage ({commit}, {alId, image}) {
      const frmData = new FormData()
      frmData.append('file', image.blob)
      return api.put(`/api/availabilitylists/${alId}/image`, frmData, {
          progress (e) {
              commit(types.UPDATE_AL_STORE, {'al.image.uploadProgress': Math.round(e.loaded / e.total * 100)})
          }
      }).finally(() => {
          commit(types.UPDATE_AL_STORE, {'al.image.uploadProgress': 0})
      })
  },

  getAl ({state, commit, dispatch}, alId) {
      return api.get(`/api/availabilitylists/${alId}`).then(({data: al}) => {
          commit(types.UPDATE_AL_STORE, {al})
          dispatch('trackAlData')
      })
  },

  deleteAl ({state}) {
      return api.delete(`/api/availabilitylists/${state.al.id}`)
  },

  trackAlPanelData ({state}, index) {
      // Either track everything or just specified panel
      const panels = index !== undefined ? [state.panels[index]] : state.panels

      // Track both panel and every items in the panel
      for (const panel of panels) {
          changeTracker.track(panel)
          if (panel.items) {
              _.each(panel.items, function (item) {
                  changeTracker.track(item)
              })
          }
      }
  },
  getPanels ({state, commit, dispatch}, alId) {
      return api.get(`/api/availabilitylists/${alId}/panels`).then(({data: panels}) => {
          // Initialize panel as expanding
          panels.forEach(processPanelData)
          commit(types.UPDATE_AL_STORE, {panels})
          dispatch('trackAlPanelData')
      })
  },
  savePanelApi ({state, dispatch}, index) {
      const panel = state.panels[index]
      if (_.isNumber(panel.id)) {
          return dispatch('createPanelApi', {index})
      } else {
          return dispatch('updatePanelApi', {index})
      }
  },
  createPanelApi ({state, commit, dispatch}, {index}) {
      const alId = state.al.id
      const panel = state.panels[index]
      const newPanel = _.pick(panel, _.without(PANEL_PROPS, 'image'))
      newPanel.items = _.map(newPanel.items, toItemForCreating)
      return api.post(`/api/availabilitylists/${alId}/panels`, newPanel, {headers: RETURN_REP})
          .then(async res => {
              if (panel.image) {
                  await dispatch('uploadPanelImage', {image: panel.image, index, panelId: res.data.id})
                  // Keep the image in view after reload
                  // eslint-disable-next-line no-param-reassign
                  res.data.image = panel.image
              }
              return {panel: res.data, index}
          })
  },
  async updatePanelApi ({state, commit, dispatch}, {index}) {
      const originalChanged = changeTracker.changed(state.panels[index])
      const changed = _.pick(originalChanged, PANEL_PROPS)
      const alId = state.al.id
      const panel = state.panels[index]
      const panelId = state.panels[index].id

      if (_.isEmpty(changed) || !_.isString(panel.id)) {
          return {panel, index}
      }

      // Check change in items_order
      const originalItemsOrder = changeTracker.getOriginal(state.panels[index])
      const newItemsOrder = panel.items.map(item => item.id < 0 ? null : item.id)
      if (!_.equals(originalItemsOrder, newItemsOrder)) {
          changed.items_order = newItemsOrder
      }

      const payload = _.cloneDeep(changed)
      if (changed.items) {
          const productProps = ['family', 'variety', 'cutpot', 'origin']
          const items = []
          // Convert changed(created/updated) items to API-suitable format
          for (let i = 0; i < changed.items.length; i++) {
              const item = changed.items[i]
              if (item.id < 0) {
                  // Remove id if creating item
                  items.push(toItemForCreating(item))
                  continue
              }
              // Only get changed field in item,
              // also ignored special fields starting with $
              const changedItem = _.omitBy(changeTracker.changed(item), (value, key) => key.startsWith('$'))

              if (_.isEmpty(changedItem)) {
                  continue
              }
              // If update 1 prop of product, need all required prop
              if (!_.isEmpty(_.intersection(_.keys(changedItem), productProps))) {
                  changedItem.family = item.family
                  changedItem.variety = item.variety
                  changedItem.cutpot = item.cutpot
                  changedItem.origin = item.origin
              }
              changedItem.id = item.id
              items.push(changedItem)
          }

          payload.items = items
      }

      if (originalChanged.deletedItems) {
          originalChanged.deletedItems.forEach(({id}) => {
              payload.items.push({id, _delete: true})
          })
      }

      let image
      if ('image' in payload && payload.image) {
          image = payload.image
          payload.image = null
      }
      return api.patch(`/api/availabilitylists/${alId}/panels/${panelId}`, payload, {headers: RETURN_REP})
          .then(async res => {
              if (image) {
                  await dispatch('uploadPanelImage', {image, index, panelId})
                  // eslint-disable-next-line no-param-reassign
                  res.data.image = image
              }
              return {panel: res.data, index}
          })
  },
  uploadPanelImage ({state, commit}, {image, index, panelId}) {
      const progressPath = `panels[${index}].image.uploadProgress`
      const frmData = new FormData()
      frmData.append('file', image.blob)
      return api.put(`/api/availabilitylists/${state.al.id}/panels/${panelId}/image`, frmData, {
          progress (e) {
              commit(types.UPDATE_AL_STORE, {[progressPath]: Math.round(e.loaded / e.total * 100)})
          }
      }).finally(() => {
          commit(types.UPDATE_AL_STORE, {[progressPath]: 0})
      })
  },
  async deletePanelApi ({state, commit}, index) {
      const panel = state.panels[index]
      // If this is an existing panel then we call API to delete it
      if (_.isString(panel.id)) {
          await api.delete(`/api/availabilitylists/${state.al.id}/panels/${panel.id}`)
      }
      return panel
  },
  addPanelLocal ({state, commit}, data = {}) {
      const uniqueId = _.uniqueId() * -1
      const newPanel = {
          trackId: uniqueId,
          id: uniqueId,
          title: '',
          representative: '',
          email: '',
          items: [], // Array element for deleted item
          files: [],
          image: null,
          description: '',
          showColumns: defaultShowColumns,
          ...data
      }
      commit(types.UPDATE_AL_STORE, {path: 'panels', value: _.concat(state.panels, newPanel)})
  },
  deletePanelLocal ({state, commit}, panel) {
      // Remove the panel from state
      const panels = _.without(state.panels, panel)
      commit(types.UPDATE_AL_STORE, {path: 'panels', value: panels})
  },
  storePanelLocal ({commit, state, dispatch, getters}, {panel, index}) {
      const clonedPanel = _.cloneDeep(panel)
      processPanelData(clonedPanel)
      // Keep expand and showColumns property
      clonedPanel.expand = state.panels[index].expand
      clonedPanel.showColumns = state.panels[index].showColumns
      // Create a new panels array
      const panels = _.clone(state.panels)

      // Keep showing image
      const newPanel = {...clonedPanel, image: panels[index].image, uploadProgress: 0, showProgress: false}
      newPanel.trackId = panels[index].trackId
      panels.splice(index, 1, newPanel)

      // Update the panels array
      commit(types.UPDATE_AL_STORE, {panels})

      dispatch('trackAlPanelData', index)
  },
  addItems ({commit, state}, {panelIndex, itemNumber, addIndex}) {
      const panel = state.panels[panelIndex]
      // Generate blank items to add
      const newItems = _.range(itemNumber).map((item) => {
          return {
              id: _.uniqueId() * -1,
              cutpot: 'cut',
              family: '',
              variety: '',
              price: null,
              unit: '',
              grade: '',
              quantity: null,
              origin: '',
              color: '',
              note: '',
              $errors: {}
          }
      })

      const items = _.clone(panel.items)
      items.splice(_.isNumber(addIndex) ? addIndex : items.length, 0, ...newItems)
      commit(types.UPDATE_AL_STORE, {[`panels[${panelIndex}].items`]: items})
  },
  copyItems ({commit, state}, {panelIndex, itemIndexes, addIndex}) {
      const panel = state.panels[panelIndex]
      const newItems = _.map(itemIndexes, function (idx) {
          const newItem = _.clone(panel.items[idx])
          newItem.id = _.uniqueId() * -1
          return newItem
      })

      const items = _.clone(panel.items)
      items.splice(_.isNumber(addIndex) ? addIndex : items.length, 0, ...newItems)
      commit(types.UPDATE_AL_STORE, {[`panels[${panelIndex}].items`]: items})
  },
  deleteItems ({commit, state}, {panelIndex, itemIndexes}) {
      const panel = state.panels[panelIndex]
      const deleteItems = itemIndexes.map((index) => panel.items[index])
      const payload = {}

      // Remove the item from items list
      payload[`panels.${panelIndex}.items`] = _.without(state.panels[panelIndex].items, ...deleteItems)

      // If this is not a new item, queue them to be deleted
      const deletedOldItems = deleteItems.filter((item) => _.isString(item.id))
      if (deletedOldItems.length) {
          payload[`panels.${panelIndex}.deletedItems`] = _.concat(panel.deletedItems, deletedOldItems)
      }
      commit(types.UPDATE_AL_STORE, payload)
  }
}

function processPanelData (panel) {
  /* eslint-disable no-param-reassign */
  panel.items = _.map(panel.items, function (item) {
      const newItem = _.omit(item, 'images')
      newItem.$errors = {}
      return newItem
  })
  panel.trackId = panel.id
  panel.expand = false
  panel.deletedItems = []
  panel.uploadProgress = 0
  if (!_.has(panel, 'image')) {
      panel.image = null
  }
  panel.showColumns = defaultShowColumns
  panel.items_order = _.map(panel.items, 'id')
  /* eslint-enable no-param-reassign */
}

function toItemForCreating (item) {
  return _.omitBy(item, (value, key) => key === 'id' || key.startsWith('$'))
}

export default {namespaced, state, getters, mutations, actions}
