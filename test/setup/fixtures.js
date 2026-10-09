import { afterAll, afterEach, beforeAll } from 'vitest';
import $ from 'jquery';

let fixtures;

beforeAll(() => {
  fixtures = $('<div id="fixtures">').appendTo(document.body);
});

afterEach(() => {
  clearFixtures();
  window.location.hash = '';
});

afterAll(() => {
  fixtures.remove();
});

export function setFixtures(...contents) {
  contents.forEach(content => fixtures.append(content));
}

export function clearFixtures() {
  fixtures.empty();
}
