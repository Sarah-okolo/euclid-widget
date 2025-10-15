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
  }

  async init() {
    // container
    this.root = createEl('div', { class: 'euclid-root' });
    this.applyPosition();

    // bubble
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

    // load config
    try {
      this._showLoadingTip('Loading assistant...');
      this.config = await fetchBotConfig(this.botId);
      this._hideLoadingTip();
      if (this.defaultState === 'open') await this.open();
    } catch (err) {
      this._hideLoadingTip();
      this._showError(`Could not load bot: ${err.message}`);
    }

    // style bubble background
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
    this.expandUp = p.startsWith('bottom'); // expand upward when bottom
  }

  async open() {
    if (this.window) return;
    const win = createChatWindow({
      botName: (this.config && this.config.botName) || 'Assistant',
      color: this.color,
      textColor: this.textColor,
      bubbleIcon: this.bubbleIcon,
      onSend: async (message, append) => {
        append('bot', 'Thinking...');
        try {
          const resp = await sendQuery({
            botId: this.botId,
            sessionId: this.sessionId,
            message,
            authToken: this.authToken
          });
          append('bot', resp.answer || (resp && resp.text) || 'No answer');
        } catch (err) {
          append('bot', `Error: ${err.message}`);
        }
      },
      onClose: () => {
        if (this.window && this.window.root) {
          this.window.root.remove();
          this.window = null;
        }
      }
    });

    // attach window either above or below bubble
    if (this.expandUp) {
      this.root.insertBefore(win.root, this.root.firstChild);
    } else {
      this.root.appendChild(win.root);
    }

    this.window = win;
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
