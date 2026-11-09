(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('[data-motion]').forEach(function (element) {
      element.classList.add('is-visible');
    });
    return;
  }

  var elements = document.querySelectorAll('[data-motion]');
  if (!elements.length) return;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    {
      root: null,
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.12,
    }
  );

  elements.forEach(function (element) {
    observer.observe(element);
  });
})();
