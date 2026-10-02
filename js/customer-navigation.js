/* Reflect the selected Customer Experience section without changing its navigation. */
(function () {
  'use strict';
  var links = document.querySelectorAll('.customer-journey-nav a[href^="#"]');
  if (!links.length) return;
  function updateActiveSection() {
    var current = window.location.hash === '#intention' ? '#intention' : '#discover';
    links.forEach(function (link) {
      var active = link.getAttribute('href') === current;
      link.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (window.location.hash !== '#discover' && window.location.hash !== '#intention') return;
    // Anchor routes must enter below the measured sticky header, including after a surface is revealed.
    window.requestAnimationFrame(function () {
      var section = document.querySelector(current);
      var header = document.querySelector('.customer-header');
      if (!section || section.hidden || !header) return;
      window.scrollTo({ top: Math.max(0, window.scrollY + section.getBoundingClientRect().top - header.getBoundingClientRect().height), behavior: 'instant' });
    });

  }
  window.addEventListener('hashchange', updateActiveSection);
  updateActiveSection();
}());
