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

  const { routes, initialRoute, fallback, noURL } = props;

  const [routeStack, setRouteStack] = useState(() => createInitialRouteStack());

  useComponentWillMount(setInitialLocation);

  useEffect(() => storage.set(exportRouteStack()), [routeStack]);
  useEffect(() => { props.onRouteStackChange && props.onRouteStackChange(exportRouteStack()) }, [routeStack]);

  useEffect(() => registerNavigator({ navigate, back }), []);

  useEffect(() => {
    popupManager.on('request', handlerPopupRequest);
    return () => popupManager.off('request', handlerPopupRequest);
  },[]);

  const [popups, setPopups] = useState([]);

  return (
    <div data-testid = "navigator">
      {
        routeStack.map((route, index) => {
          const display = index === 0 ? 'block' : 'none';

          if (!route.Page)
            return null;

          const exportedRoute = exportRouteForPage(route);
          exportedRoute.isActive = index === 0;

          return (
            <div key = { `${route.name}.${route.path}` } style = {{ display }}>
              { React.createElement(route.Page, { ...props, route: exportedRoute }) }
            </div>
          );
        })
      }

      <Modal visible = {popups.length > 0} >
        {
          popups.map((popup, index) => {
            if (popup.props && popup.props.overlay) {
              return (
                <Modal visible = {true} key = {index}>
                  { React.createElement(popup.Popup, { ...popup.data, self: popup }) }
                </Modal>
              )
            } else {
              return React.createElement(popup.Popup, { ...popup.data, self: popup, key: index });
            }
          })
        }
      </Modal>
    </div>
  );


  function createInitialRouteStack() {
    let name = getInitialRouteName();

    if (routes[name].redirect) {
      name = routes[name].redirect;
      env.isWeb() && routeUtil.path.replace(routes[name].path);
    }

    (env.isWeb() && name === fallback) && routeUtil.path.replace(routes[name].path);

    const routeStack = importRouteStack(storage.get());

    const index = routeStack.findIndex(route => (route.name === name) && (route.path !== undefined? route.path === routeUtil.path() : true));

    if (index === -1) {
      const route = { ...routes[name] };
      route.params = env.isWeb() && route.path? routeUtil.match(routes[name].path).params : {};
      route.path = env.isWeb() && route.path? routeUtil.constructLocationPath(route.path, route.params) : undefined;
      routeStack.unshift({ name, ...route });
    } else {
      routeStack.unshift(routeStack.splice(index, 1)[0]);
    }

    return routeStack;
  }

  function getInitialRouteName() {
    if (env.isNative()) {
      return initialRoute || fallback;
    } else if(noURL) {
      return matchNameFromInitialRoute() || fallback;
    } else {
      return Object.keys(routes).find(name => routes[name].path && routeUtil.match(routes[name].path).isMatched) || fallback;
    }
  }

  function matchNameFromInitialRoute() {
    if (!initialRoute) return undefined;
    if (typeof initialRoute === 'string') {
      if (!routes[initialRoute]) return undefined;
      if (routes[initialRoute].path) {
        return routeUtil.match(routes[initialRoute].path).isMatched? initialRoute : undefined;
      } else {
        return initialRoute;
      }
    } else {
      for (let path in initialRoute) {
        const routeName = initialRoute[path];
        if (routeUtil.match(routes[routeName].path).isMatched) {
          return routeName;
        }
      }
      return undefined;
    }
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
      route.path = env.isWeb() && route.path? routeUtil.constructLocationPath(route.path, route.params) : undefined;
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

  function back() {
    const routeStack = importRouteStack(storage.get());
    if (routeStack.length > 1) {
      routeStack.shift();
      const route = routeStack[0];
      env.isWeb() && routeUtil.path.replace(route.path);
      setRouteStack(routeStack);
    }
  }

  function handlerPopupRequest({ action }) {
    if (!/^open$|^resolve$|^reject$/.test(action))
      return;

    if (action === 'open')
      bodyScroll.disable();
    else
      bodyScroll.enable();

    setPopups([...popupManager.getActivePopups()]);
  }

}

Navigator.propTypes = {
  routes: validateRoutes
};

function validateRoutes(props) {
  const { routes }= props;
  if ( !routes ) return new Error("Invalid routes definition");
  if ( !Object.keys(routes).every(name => routes[name].Page || routes[name].redirect) ) return new Error("Invalid routes definition");
  if ( !props.noURL && env.isWeb() && !Object.keys(routes).every(name => routes[name].path || routes[name].redirect) ) return new Error("Invalid routes definition");
  if ( props.initialRoute && typeof props.initialRoute === 'string' && Object.keys(routes).indexOf(props.initialRoute) === -1 ) return new Error("initialRoute is not defined in routes object");
  if ( props.fallback && Object.keys(routes).indexOf(props.fallback) === -1 ) return new Error("fallback is not defined in routes object");
  if ( props.noURL && !props.initialRoute ) return new Error("initialRoute must be defined when noURL = true");
  if ( env.isWeb() && Object.keys(routes).some(name => routes[name].path) && !props.fallback) return new Error("Must define fallback when using route with path");
  return null;
}
