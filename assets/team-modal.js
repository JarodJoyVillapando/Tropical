(function () {
  const modal = document.getElementById('team-modal');

  if (!modal) return;

  const dialog = modal.querySelector('.team-modal__dialog');
  const panels = modal.querySelectorAll('[data-team-member-panel]');
  const openButtons = document.querySelectorAll('[data-team-modal-open]');
  const closeTriggers = modal.querySelectorAll('[data-team-modal-close]');
  let lastFocusedElement = null;

  function getPanel(memberId) {
    return modal.querySelector(`[data-team-member-panel="${memberId}"]`);
  }

  function openModal(memberId) {
    const panel = getPanel(memberId);
    if (!panel) return;

    lastFocusedElement = document.activeElement;

    panels.forEach((item) => {
      item.hidden = true;
    });

    panel.hidden = false;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');

    const title = panel.querySelector('.team-modal__name');
    if (title) {
      modal.setAttribute('aria-labelledby', title.id);
    }

    document.body.style.overflow = 'hidden';
    modal.querySelector('.team-modal__close')?.focus();
  }

  function closeModal() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.removeAttribute('aria-labelledby');

    panels.forEach((item) => {
      item.hidden = true;
    });

    document.body.style.overflow = '';

    if (lastFocusedElement) {
      lastFocusedElement.focus();
    }
  }

  openButtons.forEach((button) => {
    button.addEventListener('click', function () {
      openModal(button.dataset.teamMemberId);
    });
  });

  closeTriggers.forEach((trigger) => {
    trigger.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', function (event) {
    if (modal.hidden) return;

    if (event.key === 'Escape') {
      closeModal();
    }

    if (event.key === 'Tab' && dialog) {
      const focusable = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const focusableItems = Array.from(focusable).filter((el) => !el.hidden && el.offsetParent !== null);

      if (focusableItems.length === 0) return;

      const first = focusableItems[0];
      const last = focusableItems[focusableItems.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
})();
