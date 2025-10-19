// src/widget.js
import { createEl, uid } from './utils';
import { createBubble } from './ui/bubble';
import { createChatWindow } from './ui/window';
import { fetchBotConfig, sendQuery } from './api';

const DEFAULTS = {
  color: '#06B6D4',
  textColor: '#ffffff',
  defaultState: 'closed',
  position: 'bottom-right'
};

// Helper: start/stop typing animation
function startTypingAnimation(win, append) {
  append('bot', '▪️');
  const findDotsNode = () => {
    const all = win.root.querySelectorAll('*');
    for (let i = all.length - 1; i >= 0; i--) {
      const el = all[i];
      const txt = (el.textContent || '').trim();
      if (txt === '▪️' || txt === '▪️▪️' || txt === '▪️▪️▪️') return el;
    }
    return null;
  };

  let node = null;
  const ensureNode = () => {
    if (!node || !node.isConnected) node = findDotsNode();
    return node;
  };

  const frames = ['▪️', '▪️▪️', '▪️▪️▪️'];
  let idx = 0;
  const interval = setInterval(() => {
    const target = ensureNode();
    if (!target) return;
    idx = (idx + 1) % frames.length;
    target.textContent = frames[idx];
  }, 300);

  const stop = () => {
    clearInterval(interval);
    const target = ensureNode();
    if (target && target.parentNode) {
      let toRemove = target;
      for (let i = 0; i < 2; i++) {
        if (!toRemove.parentElement) break;
        const parent = toRemove.parentElement;
        if (parent.children.length === 1) toRemove = parent; else break;
      }
      toRemove.remove();
    }
  };
  return stop;
}

export class EuclidWidget {
  constructor({ botId, color, textColor, defaultState, position, infoMessage, bubbleIcon }) {
    this.botId = botId;
    this.color = color || DEFAULTS.color;
    this.textColor = textColor || DEFAULTS.textColor;
    this.defaultState = defaultState || DEFAULTS.defaultState;
    this.position = position || DEFAULTS.position;
    this.infoMessage = infoMessage || '';
    this.bubbleIcon = bubbleIcon || null;
    this.sessionId = uid('session');
    this.root = null;
    this.window = null;
    this.config = null;
    this.authToken = null;
    this._greeted = false;

    // 👇 stores all messages for the current page session
    this._messages = [];
  }

  async init() {
    this.root = createEl('div', { class: 'euclid-root' });
    this.applyPosition();

    const { el: bubbleWrapper, bubbleEl } = createBubble({
      color: this.color,
      textColor: this.textColor,
      infoMessage: this.defaultState === 'info' ? this.infoMessage : null,
      position: this.position,
      bubbleIcon: this.bubbleIcon,
      onClick: () => this.toggle()
    });

    this.root.appendChild(bubbleWrapper);
    document.body.appendChild(this.root);

    try {
      this._showLoadingTip('Loading assistant...');
      this.config = await fetchBotConfig(this.botId);
      this._hideLoadingTip();

      if (this.defaultState === 'open') {
        await this.open();
        this._ensureGreeting();
      }
    } catch (err) {
      this._hideLoadingTip();
      this._showError(`Could not load bot: ${err.message}`);
    }

    bubbleEl.style.background = this.color;
    bubbleEl.style.color = this.textColor;
  }

  applyPosition() {
    const p = this.position;
    const style = { position: 'fixed' };
    const gap = '20px';
    if (p.includes('bottom')) style.bottom = gap;
    if (p.includes('top')) style.top = gap;
    if (p.includes('left')) style.left = gap;
    if (p.includes('right')) style.right = gap;
    Object.assign(this.root ? this.root.style : (this.root = document.createElement('div')).style, style);
    this.expandUp = p.startsWith('bottom');
  }

  async open() {
    if (this.window) return;

    const win = createChatWindow({
      botName: (this.config && this.config.bot.botName) || 'Assistant',
      color: this.color,
      textColor: this.textColor,
      bubbleIcon: this.bubbleIcon,
      onSend: async (message, append) => {
        this._storeMessage('user', message); // 👈 store user msg
        const stopTyping = startTypingAnimation(win, append);
        try {
          const resp = await sendQuery({
            botId: this.botId,
            sessionId: this.sessionId,
            message,
            authToken: this.authToken
          });
          stopTyping();
          const answer = resp?.response || resp?.text || 'No answer';
          append('bot', answer);
          this._storeMessage('bot', answer); // 👈 store bot msg
        } catch (err) {
          stopTyping();
          const errMsg = `Error: ${err.message}`;
          append('bot', errMsg);
          this._storeMessage('bot', errMsg);
        }
      },
      onClose: () => {
        if (this.window && this.window.root) {
          this.window.root.remove();
          this.window = null;
        }
      }
    });

    if (this.expandUp) this.root.insertBefore(win.root, this.root.firstChild);
    else this.root.appendChild(win.root);

    this.window = win;

    // 👇 restore all previous messages from memory
    this._restoreMessages();

    // greet only once per page session
    this._ensureGreeting();
  }

  close() {
    if (this.window) {
      this.window.close();
      this.window = null;
    }
  }

  toggle() {
    if (this.window) this.close();
    else this.open();
  }

  _storeMessage(sender, text) {
    this._messages.push({ sender, text });
  }

  _restoreMessages() {
    if (!this.window || !this.window.root) return;
    const container = this.window.root;
    const host =
      container.querySelector('.euclid-messages') ||
      container.querySelector('.euclid-chat-body') ||
      container.querySelector('.euclid-window-body') ||
      container.querySelector('.messages') ||
      container;

    this._messages.forEach(({ sender, text }) => {
      const bubble = document.createElement('div');
      bubble.className = sender === 'bot' ? 'euclid-message euclid-bot' : 'euclid-message euclid-user';
      bubble.style.maxWidth = '85%';
      bubble.style.margin = '8px 12px';
      bubble.style.padding = '10px 12px';
      bubble.style.borderRadius = '14px';
      bubble.style.lineHeight = '1.4';
      bubble.style.fontSize = '14px';
      bubble.style.whiteSpace = 'pre-wrap';
      bubble.style.wordBreak = 'break-word';
      bubble.style.boxShadow = '0 1px 4px rgba(0,0,0,0.12)';
      if (sender === 'bot') {
        bubble.style.background = '#f2f2f2';
        bubble.style.color = '#111';
        bubble.style.alignSelf = 'flex-start';
      } else {
        bubble.style.background = this.color;
        bubble.style.color = this.textColor;
        bubble.style.alignSelf = 'flex-end';
      }
      bubble.textContent = text;
      host.appendChild(bubble);
    });
  }

  _ensureGreeting() {
    if (this._greeted) return;
    const greeting =
      `Hi there👋! I'm ${this.config.bot.botName}. ` +
      `Your personal assistant here on ${this.config.bot.businessName}. ` +
      `How can I assist you today?`;

    this._storeMessage('bot', greeting); // 👈 store greeting in memory

    if (!this.window || !this.window.root) return;
    const container = this.window.root;
    const host =
      container.querySelector('.euclid-messages') ||
      container.querySelector('.euclid-chat-body') ||
      container.querySelector('.euclid-window-body') ||
      container.querySelector('.messages') ||
      container;

    const bubble = document.createElement('div');
    bubble.className = 'euclid-message euclid-bot euclid-greeting';
    bubble.style.maxWidth = '85%';
    bubble.style.margin = '8px 12px';
    bubble.style.padding = '10px 12px';
    bubble.style.borderRadius = '14px';
    bubble.style.lineHeight = '1.4';
    bubble.style.fontSize = '14px';
    bubble.style.whiteSpace = 'pre-wrap';
    bubble.style.wordBreak = 'break-word';
    bubble.style.background = '#f2f2f2';
    bubble.style.color = '#111';
    bubble.style.alignSelf = 'flex-start';
    bubble.style.boxShadow = '0 1px 4px rgba(0,0,0,0.12)';
    bubble.textContent = greeting;
    host.appendChild(bubble);

    this._greeted = true;
  }

  _showLoadingTip(txt) {
    if (!this._loading) {
      this._loading = createEl('div', { class: 'euclid-info-tip euclid-small' }, txt);
      this.root.appendChild(this._loading);
    } else this._loading.textContent = txt;
  }

  _hideLoadingTip() {
    if (this._loading) {
      this._loading.remove();
      this._loading = null;
    }
  }

  _showError(txt) {
    const err = createEl('div', { class: 'euclid-info-tip euclid-small' }, `Error: ${txt}`);
    this.root.appendChild(err);
  }
}
