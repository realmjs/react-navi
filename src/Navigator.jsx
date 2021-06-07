"use strict"

import React, { useState, useEffect } from 'react';

import routeUtil from './route.util';
import env from './env.util';
import storage from './storage.util';
import { registerNavigator } from './nav';
import { useComponentWillMount } from './lifecycle.hook';
import EventEmitter from './event-emitter';

import popupManager from './popup-manager';
import Modal from './Modal';

import BodyScrollLocker from './body-scroll-locker';
const bodyScroll = BodyScrollLocker();

export default function Navigator(props) {

  const { routes, initialRoute, fallback } = props;

  const [routeStack, setRouteStack] = useState(() => createInitialRouteStack());

  useComponentWillMount(setInitialLocation);

  useEffect(() => storage.set(exportRouteStack()), [routeStack]);
  useEffect(() => props.onRouteStackChange && props.onRouteStackChange(exportRouteStack()), [routeStack]);

  useEffect(() => registerNavigator({ navigate }), []);

  useEffect(() => {
    popupManager.on('request', handlerPopupRequest);
    return () => popupManager.off('request', handlerPopupRequest);
  },[]);

  const [popupCount, setPopupCount] = useState(0);
  const popups = popupManager.getActivePopups();

  const route = routeStack[0];

  if (!route.Page)
    return null;

  const exportedRoute = exportRouteForPage(route);
  exportedRoute.isActive = true;

  return (
    <div data-testid = "navigator">
      { React.createElement(route.Page, { ...props, route: exportedRoute }) }
      <Modal visible = {popupCount > 0} >
        <div style = {{ position: 'relative' }}>
        {
          popups.map((popup, index) => React.createElement(popup.Popup, { ...popup.props, self: popup, key: index }))
        }
        </div>
      </Modal>
    </div>
  );


  function createInitialRouteStack() {
    if ( env.isWeb() && !Object.keys(routes).every(name => routes[name].path || routes[name].redirect) )
      return [];

    let name = env.isWeb()?
                  Object.keys(routes).find(name => routes[name].path && routeUtil.match(routes[name].path).isMatched) || fallback
                :
                  initialRoute || fallback;

    if (routes[name].redirect) {
      name = routes[name].redirect;
      env.isWeb() && routeUtil.path.replace(routes[name].path);
    }

    (env.isWeb() && name === fallback) && routeUtil.path.replace(routes[name].path);

    const routeStack = importRouteStack(storage.get());

    const index = routeStack.findIndex(route => route.name === name && route.path === routeUtil.path());

    if (index === -1) {
      const route = { ...routes[name] };
      route.params = env.isWeb()? routeUtil.match(routes[name].path).params : undefined;
      route.path = env.isWeb()? routeUtil.constructLocationPath(route.path, route.params) : undefined;
      routeStack.unshift({ name, ...route });
    } else {
      routeStack.unshift(routeStack.splice(index, 1)[0]);
    }

    return routeStack;
  }

  function setInitialLocation() {
    const route = routeStack[0];
    env.isWeb() && routeUtil.path.replace(route.path);
  }

  function exportRouteStack() {
    return routeStack.map(route => {
      const {Page, ...rest} = route;
      return rest;
    });
  }

  function importRouteStack(routeStack) {
    if (!routeStack)
      return [];

    return routeStack.map(route => {
      return { ...route, Page: routes[route.name].Page, data: routes[route.name].data };
    });
  }

  function exportRouteForPage(route) {
    const {Page, ...exported} = { ...route };
    exported.event = new EventEmitter();
    return exported;
  }

  function navigate(name, params) {
    if (!routes[name]) {
      console.error(`[Error: route name ${name} does not exist]`);
      return false;
    }
    const route = { ...routes[name] };
    route.params = params || {};
    try {
      route.path = env.isWeb()? routeUtil.constructLocationPath(route.path, route.params) : undefined;
    } catch(err) {
      console.error("[Error: route params do not match the param's pattern]");
      return false;
    }
    env.isWeb() && routeUtil.path.replace(route.path);
    setRouteStack(routeStack => addToRouteStackIfNotExist(routeStack, { name, ...route }));
  }

  function addToRouteStackIfNotExist(routeStack, route) {
    const index = routeStack.findIndex(r => r.name === route.name && r.path === route.path);
    if (index === -1) {
      return [route, ...routeStack];
    } else {
      routeStack.unshift(routeStack.splice(index, 1)[0]);
      return [...routeStack];
    }
  }

  function handlerPopupRequest({ action }) {
    if (!/^open$|^resolve$|^reject$/.test(action))
      return;

    if (action === 'open')
      bodyScroll.disable();
    else
      bodyScroll.enable();

    setPopupCount(popupManager.getActivePopups().length);
  }

}

Navigator.propTypes = {
  routes: validateRoutes
};

function validateRoutes(props) {
  const { routes }= props;
  if ( !routes ) return new Error("Invalid routes definition");
  if ( !Object.keys(routes).every(name => routes[name].Page || routes[name].redirect) ) return new Error("Invalid routes definition");
  if ( env.isWeb() && !Object.keys(routes).every(name => routes[name].path || routes[name].redirect) ) return new Error("Invalid routes definition");
  if ( props.initialRoute && Object.keys(routes).indexOf(props.initialRoute) === -1 ) return new Error("initialRoute is not defined in routes object");
  if ( props.fallback && Object.keys(routes).indexOf(props.fallback) === -1 ) return new Error("fallback is not defined in routes object");
  return null;
}
