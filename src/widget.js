// src/widget.js
import { createEl, uid } from './utils';
import { createBubble } from './ui/bubble';
import { createChatWindow } from './ui/window';
import { fetchBotConfig, sendQuery } from './api';
import { createConfirm } from './ui/modals';
import { ensureLoggedIn, getAccessToken } from './auth';

const DEFAULTS = {
  color: '#06B6D4',
  textColor: '#ffffff',
  defaultState: 'closed',
  position: 'bottom-right'
};

// Heuristic: messages likely to be actions → ask confirmation first (client-side safety)
const ACTION_TRIGGERS = /\b(update|create|delete|remove|send|email|invite|approve|schedule|book|pay|charge|transfer)\b/i;

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
      const cfgResp = await fetchBotConfig(this.botId);
      this.config = cfgResp?.bot || cfgResp; // your API returns { status, bot }
      this._hideLoadingTip();

      // Prewarm token silently if possible (optional)
      await this._maybePrewarmAuth();

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

  async _maybePrewarmAuth() {
    const { authDomain, authAudience, authClientId } = this._authCfg();
    if (authDomain && authAudience && authClientId) {
      try {
        // Silent attempt; doesn’t show popup if there’s no session
        await ensureLoggedIn({ domain: authDomain, audience: authAudience, clientId: authClientId });
        this.authToken = await getAccessToken({ domain: authDomain, audience: authAudience, clientId: authClientId });
      } catch {
        // Ignore; we’ll prompt only when needed
      }
    }
  }

  _authCfg() {
    const b = this.config || {};
    return {
      domain: (b.authDomain || '').replace(/^https?:\/\//, ''), // ensure bare domain
      audience: b.authAudience,
      clientId: b.authClientId, // you said you’ve added this already
    };
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
      botName: (this.config && this.config.botName) || 'Assistant',
      color: this.color,
      textColor: this.textColor,
      bubbleIcon: this.bubbleIcon,
      onSend: (message, append) => this._handleSend(win, message, append),
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
    this._restoreMessages();
    this._ensureGreeting();
  }

  async _handleSend(win, message, append) {
    this._storeMessage('user', message);

    // Client-side confirmation for likely actions (best-effort UX)
    if (ACTION_TRIGGERS.test(message)) {
      const confirmed = await this._confirmModal(`Allow ${this.config?.botName || "the assistant"} to proceed with this action?`);
      if (!confirmed) {
        const canceled = "I can't proceed because you have refused to grant permission.";
        append('bot', canceled);
        this._storeMessage('bot', canceled);
        return;
      }
    }

    const stopTyping = startTypingAnimation(win, append);
    try {
      // If we already have a token, send it. Otherwise, try once without; we’ll handle 401 and retry.
      const attempt = async (withAuth) => {
        return sendQuery({
          botId: this.botId,
          sessionId: this.sessionId,
          message,
          authToken: withAuth ? this.authToken : null
        });
      };

      let resp;
      try {
        resp = await attempt(!!this.authToken);
      } catch (e) {
        // If unauthorized, try to login and retry once
        if (e.status === 401) {
          const ok = await this._loginIfNeeded();
          if (ok) {
            resp = await attempt(true);
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }

      stopTyping();
      const answer = resp?.response || resp?.text || 'No answer';
      append('bot', answer);
      this._storeMessage('bot', answer);
    } catch (err) {
      stopTyping();
      const errMsg = `Error: ${err.message}`;
      append('bot', errMsg);
      this._storeMessage('bot', errMsg);
    }
  }

  async _loginIfNeeded() {
    const { authDomain, authAudience, authClientId } = {
      authDomain: this._authCfg().domain,
      authAudience: this._authCfg().audience,
      authClientId: this._authCfg().clientId
    };

    if (!authDomain || !authAudience || !authClientId) {
      // Bot not configured for Auth0, cannot login
      return false;
    }

    try {
      await ensureLoggedIn({ domain: authDomain, audience: authAudience, clientId: authClientId });
      this.authToken = await getAccessToken({ domain: authDomain, audience: authAudience, clientId: authClientId });
      return true;
    } catch (e) {
      console.warn("Auth0 login failed:", e);
      return false;
    }
  }

  async _confirmModal(text) {
    return new Promise((resolve) => {
      const node = createConfirm({
        title: 'Please confirm',
        text,
        color: this.color,
        textColor: this.textColor,
        onConfirm: () => { cleanup(); resolve(true); },
        onCancel: () => { cleanup(); resolve(false); },
      });
      node.style.position = 'fixed';
      node.style.zIndex = '2147483647';
      node.style.left = '50%';
      node.style.top = '50%';
      node.style.transform = 'translate(-50%, -50%)';
      node.style.maxWidth = '420px';
      node.style.width = 'calc(100% - 40px)';
      node.style.background = '#fff';
      node.style.borderRadius = '14px';
      node.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
      node.style.overflow = 'hidden';
      node.style.color = '#111';

      const backdrop = createEl('div', {
        style: {
          position: 'fixed',
          inset: '0',
          background: 'rgba(0,0,0,0.35)',
          zIndex: '2147483646'
        }
      });

      const cleanup = () => {
        backdrop.remove();
        node.remove();
      };

      document.body.appendChild(backdrop);
      document.body.appendChild(node);
    });
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
    const b = this.config || {};
    const greeting = `Hi there👋! I'm ${b.botName || 'your assistant'}. Your personal assistant here on ${b.businessName || 'this site'}. How can I assist you today?`;
    this._storeMessage('bot', greeting);

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
