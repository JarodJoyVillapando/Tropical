document.documentElement.classList.remove('no-js');

(function () {
  const header = document.querySelector('.header');

  if (!header) return;

  let isScrolled = false;
  const SCROLL_ENTER = 24;
  const SCROLL_LEAVE = 4;

  function updateHeaderHeight() {
    document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
  }

  function setScrolled(scrolled) {
    if (scrolled === isScrolled) return;

    isScrolled = scrolled;
    header.classList.toggle('header--scrolled', scrolled);
    updateHeaderHeight();
  }

  function updateScrollState() {
    const scrollY = window.scrollY;

    if (!isScrolled && scrollY > SCROLL_ENTER) {
      setScrolled(true);
    } else if (isScrolled && scrollY <= SCROLL_LEAVE) {
      setScrolled(false);
    }
  }

  updateHeaderHeight();
  updateScrollState();

  window.addEventListener('scroll', updateScrollState, { passive: true });
  window.addEventListener('resize', updateHeaderHeight);
})();
