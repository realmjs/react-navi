"use strict"

import "core-js/stable";
import "regenerator-runtime/runtime";

import { act } from "react-dom/test-utils";

import { renderHook } from '@testing-library/react-hooks';
import { useDocumentTitle } from '../src';

import EventEmitter from '../src/event-emitter';

test("Do not set document title if route is NOT active", () => {

  const route = { title: 'Route Title', isActive: false };

  document.title = 'Document Title';

  renderHook(() => useDocumentTitle(route));

  expect(document.title).toBe('Document Title');

});

test("Do not set document title if route title is not defined", () => {

  const route = { isActive: true };

  document.title = 'Document Title';

  renderHook(() => useDocumentTitle(route));

  expect(document.title).toBe('Document Title');

});

test("Set the title defined in route object if route is active", () => {

  const route = { title: 'Route Title', isActive: true };

  document.title = 'Document Title';

  renderHook(() => useDocumentTitle(route));

  expect(document.title).toBe('Route Title');

});

test("Set the title defined in route object with params and static data", () => {

  const params = { p1: 'param*1', p2: 'param*2' };
  const data = { d1: 'd*1', d2: 'd*2', d3: { d31: 'd*31', d32: { d321: 'd*321' } } };
  const route = { title: 'Route {:p1}/{:p2}-{{d1}}/{{d2}}/{{d3.d31}}/{{d3.d32.d321}}', params, data, isActive: true };

  renderHook(() => useDocumentTitle(route));

  expect(document.title).toBe('Route param*1/param*2-d*1/d*2/d*31/d*321');

});

test("Set the title defined in route object with lazy data", async () => {

  const fetchingData = { status: 'fetching', result: { pass: { score: 50 } } };
  const fetchedData = { status: 'updated', result: { pass: { score: 100 } } };

  const data = (params, props, event) => {
    event.on('action', () => event.emit('update', { scope: 'data', data: fetchedData }));
    return Promise.resolve(fetchingData);
  };

  const event = new EventEmitter();
  const route = { title: 'Test {{status}}/{{result.pass.score}}', params: {}, data, event, isActive: true };

  document.title = 'Document Title';

  const { waitForNextUpdate } = renderHook(() => useDocumentTitle(route));
  expect(document.title).toBe('Document Title');

  await waitForNextUpdate();
  expect(document.title).toBe('Test fetching/50');

  act(() => event.emit('action'));
  expect(document.title).toBe('Test updated/100');

});
