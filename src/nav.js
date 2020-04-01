"use strict"

export default {
  __isNavRegistered : false,
  __popup: null,
  __route: null,
  register(nav) {
    if (this.__isNavRegistered) {
      throw new Error("Only one Navigator can be registered!")
    }
    this.__isNavRegistered = true;
    this.__popup = (popup, options, cb) => nav.__createPopup('__global', popup, options, cb);
    this.__route = nav.route;
  },
  destroy() {
    this.__isNavRegistered = false;
    this.__popup = null;
    this.__route = null;
  },
  popup(popup, options, cb) {
    if (this.__popup === null) {
      return Promise.reject('Navigator is not mounted or has been destroyed');
    }
    return this.__popup(popup, options, cb);
  },
  navigate(root) {
    if (this.__route === null) {
      return Promise.reject('Navigator is not mounted or has been destroyed');
    }
    return this.__route.navigate(root);
  }
};
