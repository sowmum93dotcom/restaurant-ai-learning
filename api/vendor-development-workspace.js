'use strict';
const inspection = require('./_lib/vendor-inspection');

function rewriteDevelopmentHtml(html) {
  return String(html)
    .replaceAll('/selling-vendor/inspect/manage', '/selling-vendor/manage')
    .replaceAll('/selling-vendor/inspect', '/selling-vendor')
    .replace('src="/js/vendor-inspection.js"', 'src="/js/vendor-development-workspace.js"');
}

module.exports = async function handler(req, res) {
  const proxy = Object.create(res);
  proxy.send = function send(body) {
    return res.send(rewriteDevelopmentHtml(body));
  };
  return inspection.createHandler()(req, proxy);
};

module.exports.rewriteDevelopmentHtml = rewriteDevelopmentHtml;
