// src/ui/modals.js
import { createEl } from '../utils';

export function createConfirm({ title = 'Confirm', text = '', onConfirm, onCancel, color, textColor }) {
  const box = createEl('div', { class: 'euclid-window' });

  // Header
  const header = createEl('div', { class: 'euclid-header' });
  header.style.background = color || 'var(--euclid-color, #06B6D4)';
  header.style.color = textColor || 'var(--euclid-text-color, #fff)';
  header.appendChild(createEl('div', {}, title));

  const closeBtn = createEl('button', {
    class: 'euclid-btn',
    onclick: onCancel,
    style: {
      background: '#eee',
      color: '#000'
    }
  }, 'Close');

  header.appendChild(closeBtn);
  box.appendChild(header);

  // Message content
  box.appendChild(createEl('div', { class: 'euclid-messages' }, text));

  // Footer with confirm/cancel buttons
  const footer = createEl('div', { class: 'euclid-center' }, [
    createEl('button', {
      class: 'euclid-btn',
      onclick: onConfirm,
      style: {
        background: color || 'var(--euclid-color, #06B6D4)',
        color: textColor || 'var(--euclid-text-color, #fff)'
      }
    }, 'Confirm'),

    createEl('button', {
      class: 'euclid-btn',
      onclick: onCancel,
      style: { background: '#ddd', color: '#000' }
    }, 'Cancel')
  ]);

  box.appendChild(footer);

  return box;
}
