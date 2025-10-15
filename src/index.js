// src/index.js
import { EuclidWidget } from './widget';
import cssText from './styles.css?raw';

function injectStyles(text) {
  if (document.getElementById('euclid-styles')) return;
  const s = document.createElement('style');
  s.id = 'euclid-styles';
  s.innerHTML = text;
  document.head.appendChild(s);
}

function readAttributes(scriptEl) {
  return {
    botId: scriptEl.getAttribute('data-bot-id'),
    color: scriptEl.getAttribute('data-color') || '#4A90E2',
    textColor: scriptEl.getAttribute('data-text-color') || '#FFFFFF',
    defaultState: scriptEl.getAttribute('data-default-state') || 'closed',
    position: scriptEl.getAttribute('data-position') || 'bottom-right',
    infoMessage: scriptEl.getAttribute('data-info-message') || '',
    bubbleIcon: scriptEl.getAttribute('data-bubble-icon') || '', // 🆕
  };
}

function findOurScript() {
  // the last script tag with "widget.js" in src is assumed to be ours
  const scripts = Array.from(document.getElementsByTagName('script'));
  return scripts.reverse().find(s => s.src && s.src.includes('widget.js')) || document.currentScript;
}

async function start() {
  injectStyles(cssText);
  const script = findOurScript();
  const attrs = readAttributes(script || document.currentScript || {});
  if (!attrs.botId) {
    console.error('Euclid widget: missing data-bot-id attribute');
    return;
  }
  // optional global to let host site configure API host: window.__EUCLID_API_HOST__ = 'https://...'
  const widget = new EuclidWidget(attrs);
  await widget.init();
}

start().catch(err => console.error('Euclid widget init error', err));
