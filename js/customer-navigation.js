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
  }
  window.addEventListener('hashchange', updateActiveSection);
  updateActiveSection();
}());
