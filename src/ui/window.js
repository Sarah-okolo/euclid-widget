// src/ui/window.js
import { createEl, uid, safeText } from '../utils';

/**
 * createChatWindow options:
 *  - botName: string
 *  - color: primary color (background for header/buttons)
 *  - textColor: text color for contrast
 *  - bubbleIcon: optional URL (png/svg)
 *  - onSend: async handler(message, appendMessage)
 *  - onClose: close handler
 */
export function createChatWindow({ botName, color, textColor, bubbleIcon, onSend, onClose }) {
  const id = uid('euclid');
  const root = createEl('div', {
    class: 'euclid-window',
    id,
    style: {
      background: '#fff',
      borderRadius: '16px',
      boxShadow: '0 6px 20px rgba(0,0,0,0.10)', // slightly lighter shadow
      display: 'flex',
      flexDirection: 'column',
      width: '380px',
      maxHeight: '465px',
      overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif',
      paddingBottom: '5px'
    }
  });

  // Header
  const header = createEl('div', {
    class: 'euclid-header',
    style: {
      background: color || 'var(--euclid-color,#06B6D4)',
      color: textColor || 'var(--euclid-text,#fff)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontWeight: '600',
    }
  });

  const titleWrap = createEl('div', {
    style: { display: 'flex', alignItems: 'center', gap: '8px' }
  });

  if (bubbleIcon) {
    const iconImg = createEl('img', {
      src: bubbleIcon,
      alt: botName || 'Bot',
      style: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        objectFit: 'cover',
      }
    });
    titleWrap.appendChild(iconImg);
  }

  titleWrap.appendChild(createEl('span', {}, botName || 'Assistant'));
  header.appendChild(titleWrap);

  const closeBtn = createEl('button', {
    class: 'euclid-btn',
    onclick: onClose,
    style: {
      background: 'transparent',
      color: textColor || '#fff',
      border: 'none',
      fontSize: '15px',
      cursor: 'pointer',
      padding: '4px 8px',
    }
  }, '✕');
  header.appendChild(closeBtn);
  root.appendChild(header);

  // Messages area
  const messages = createEl('div', {
    class: 'euclid-messages',
    style: {
      flex: '1',
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      background: '#fafafa',
    }
  });
  root.appendChild(messages);

  // Input area
  const inputWrap = createEl('div', {
    class: 'euclid-input',
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '8px',
      borderTop: '1px solid rgba(0,0,0,0.05)',
      background: '#fff',
      gap: '6px'
    }
  });

  const input = createEl('input', {
    placeholder: 'Type a message...',
    type: 'text',
    style: {
      flex: '1',
      padding: '8px 10px',
      borderRadius: '8px',
      border: '1px solid rgba(0,0,0,0.1)',
      outline: 'none',
      fontSize: '14px'
    }
  });

  const sendBtn = createEl('button', {
    class: 'euclid-btn',
    style: {
      background: color || 'var(--euclid-color,#06B6D4)',
      color: textColor || 'var(--euclid-text,#fff)',
      border: 'none',
      borderRadius: '8px',
      padding: '8px 12px',
      cursor: 'pointer',
      fontWeight: '500'
    }
  }, 'Send');

  sendBtn.addEventListener('click', async () => {
    const val = input.value.trim();
    if (!val) return;
    appendMessage('user', val);
    input.value = '';
    try {
      await onSend(val, appendMessage);
    } catch (err) {
      appendMessage('bot', `Error: ${err.message}`);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendBtn.click();
  });

  inputWrap.appendChild(input);
  inputWrap.appendChild(sendBtn);
  root.appendChild(inputWrap);

  // appendMessage
  function appendMessage(who, text) {
    const isUser = who === 'user';
    const msg = createEl('div', {
      class: `euclid-message ${who}`,
      style: {
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        background: isUser ? (color || '#06B6D4') : '#f2f2f2',
        color: isUser ? (textColor || '#fff') : '#111',
        borderRadius: '12px',
        padding: '8px 10px',
        maxWidth: '75%',
        wordBreak: 'break-word',
        fontSize: '14px',
      }
    }, safeText(text));

    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  return { root, appendMessage, close: () => root.remove() };
}
