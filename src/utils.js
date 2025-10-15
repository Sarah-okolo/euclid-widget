// src/utils.js
export function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
    } else if (k.startsWith('data-')) {
      el.setAttribute(k, v);
    } else {
      el[k] = v;
    }
  }
  (Array.isArray(children) ? children : [children]).forEach(ch => {
    if (!ch) return;
    if (typeof ch === 'string') el.appendChild(document.createTextNode(ch));
    else el.appendChild(ch);
  });
  return el;
}

export function uid(prefix = 'euclid') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function safeText(s = '') {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
