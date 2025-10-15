// src/ui/bubble.js
import { createEl } from '../utils';

/**
 * createBubble options:
 *  - color: primary background color (string)
 *  - textColor: color for text/icons that sit on primary bg (string)
 *  - onClick: click handler
 *  - infoMessage: optional string shown beside bubble
 *  - position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
 *  - bubbleIcon: optional URL to an image to use as the bubble icon
 */
export function createBubble({ color, textColor, onClick, infoMessage, position, bubbleIcon }) {
  const rightPlaced = position === 'top-right' || position === 'bottom-right';

  const bubble = createEl('button', {
    class: 'euclid-bubble',
    type: 'button',
    'aria-label': 'Open chat',
    title: 'Open chat',
    style: {
      background: color || 'var(--euclid-color,#06B6D4)',
      color: textColor || 'var(--euclid-text,#ffffff)',
      border: 'none',
      boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
      width: '56px',
      height: '56px',
      borderRadius: '999px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      cursor: 'pointer'
    }
  });

  // icon (image) or default emoji
  if (bubbleIcon) {
    const img = createEl('img', {
      src: bubbleIcon,
      alt: 'Bot',
      class: 'euclid-bubble-icon',
      style: {
        width: '60%',
        height: '60%',
        objectFit: 'contain',
        display: 'block',
        borderRadius: '50%'
      }
    });
    bubble.appendChild(img);
  } else {
    const icon = createEl('span', { class: 'euclid-icon', style: { fontSize: '20px', lineHeight: 1 } }, ['💬']);
    bubble.appendChild(icon);
  }

  // info tip element
  let tip;
  if (infoMessage) {
    tip = createEl('div', {
      class: 'euclid-info-tip euclid-small',
      role: 'note',
      style: {
        background: color || 'var(--euclid-color,#06B6D4)',
        color: textColor || 'var(--euclid-text,#ffffff)',
        padding: '10px 12px',
        borderRadius: '12px',
        boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
        fontSize: '13px',
        whiteSpace: 'nowrap',
        order: rightPlaced ? -1 : 1,
        position: 'relative'
      }
    }, infoMessage);

    // arrow element
    const arrowDir = rightPlaced ? 'right' : 'left';
    const arrow = createEl('span', {
      class: `euclid-tip-arrow euclid-tip-arrow-${arrowDir}`,
      style: {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '0',
        height: '0',
        borderTop: '6px solid transparent',
        borderBottom: '6px solid transparent',
        ...(arrowDir === 'left'
          ? { left: '-6px', borderRight: `7px solid ${color}` }
          : { right: '-6px', borderLeft: `7px solid ${color}` })
      }
    });
    tip.appendChild(arrow);
  }

  // wrapper
  const wrapper = createEl('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      cursor: 'pointer'
    }
  });

  if (infoMessage) {
    // logic for positioning info message opposite the bubble
    wrapper.appendChild(tip);
    wrapper.appendChild(bubble);

    wrapper.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      onClick && onClick(e);
    });

    return { el: wrapper, bubbleEl: bubble, tipEl: tip };
  }

  bubble.addEventListener('click', onClick);
  return { el: bubble, bubbleEl: bubble };
}
