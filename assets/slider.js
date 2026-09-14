(function () {
  function initSlider(slider) {
    const track = slider.querySelector('[data-slider-track]');
    const slides = slider.querySelectorAll('[data-slider-slide]');
    const prevBtn = slider.querySelector('[data-slider-prev]');
    const nextBtn = slider.querySelector('[data-slider-next]');
    const toggleBtn = slider.querySelector('[data-slider-toggle-autoplay]');
    const controls = slider.querySelector('.slider__controls');
    const playIcon = slider.querySelector('[data-icon-play]');
    const pauseIcon = slider.querySelector('[data-icon-pause]');

    if (!track || slides.length === 0) return;

    let index = 0;
    let autoplayTimer = null;
    let isPlaying = slider.dataset.autoplay === 'true';
    const autoplayInterval = parseInt(slider.dataset.autoplayInterval || '6000', 10);

    function getSlidesPerView() {
      return window.innerWidth >= 768
        ? parseInt(slider.dataset.slidesDesktop || '1', 10)
        : parseInt(slider.dataset.slidesMobile || '1', 10);
    }

    function getMaxIndex() {
      const perView = getSlidesPerView();
      return Math.max(0, slides.length - perView);
    }

    function updateAutoplayButton() {
      if (!toggleBtn) return;

      toggleBtn.setAttribute('aria-pressed', String(isPlaying));
      toggleBtn.setAttribute(
        'aria-label',
        isPlaying ? toggleBtn.dataset.labelPause : toggleBtn.dataset.labelPlay
      );

      if (playIcon) playIcon.hidden = isPlaying;
      if (pauseIcon) pauseIcon.hidden = !isPlaying;
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function startAutoplay() {
      if (!isPlaying) return;

      stopAutoplay();
      autoplayTimer = setInterval(function () {
        index = index >= getMaxIndex() ? 0 : index + 1;
        update();
      }, autoplayInterval);
    }

    function update() {
      const perView = getSlidesPerView();
      const slideWidth = 100 / perView;
      track.style.transform = `translateX(-${index * slideWidth}%)`;
      slides.forEach((slide) => {
        slide.style.flexBasis = `${slideWidth}%`;
      });

      if (prevBtn) prevBtn.disabled = index <= 0;
      if (nextBtn) nextBtn.disabled = index >= getMaxIndex();

      if (controls) {
        controls.hidden = getMaxIndex() <= 0;
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        index = Math.max(0, index - 1);
        update();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        index = Math.min(getMaxIndex(), index + 1);
        update();
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        isPlaying = !isPlaying;
        updateAutoplayButton();

        if (isPlaying) {
          startAutoplay();
        } else {
          stopAutoplay();
        }
      });
    }

    window.addEventListener('resize', function () {
      index = Math.min(index, getMaxIndex());
      update();
    });

    update();
    updateAutoplayButton();

    if (isPlaying) {
      startAutoplay();
    }
  }

  document.querySelectorAll('[data-slider]').forEach(initSlider);
})();
