export function query(selector, scope = document) {
  return scope.querySelector(selector);
}

export function queryAll(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}
