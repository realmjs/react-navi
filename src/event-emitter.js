"use strict"

export default {
  __events: { error: [] },

  on(type, handler) {
    this.__events[type].push(handler);
  },

  off(type, handler) {
    const index = this.__events[type].findIndex(h => h === handler);
    if (index !== -1) {
      this.__events[type].splice(index, 1);
    }
  },

  emit(type, args) {
    this.__events[type].forEach(handler => handler(args));
  },

};
