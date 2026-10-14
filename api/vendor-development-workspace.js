'use strict';
const inspection = require('./_lib/vendor-inspection');
const fs = require('node:fs');
const path = require('node:path');

function rewriteDevelopmentHtml(html) {
  return String(html)
    .replaceAll('/selling-vendor/inspect/manage', '/selling-vendor/manage')
    .replaceAll('/selling-vendor/inspect', '/selling-vendor')
    .replace('src="/js/vendor-inspection.js"', 'src="/js/vendor-development-workspace.js"');
}

module.exports = async function handler(req, res) {
  // Canonical Selling routes must remain available in Production and on
  // previews outside the explicitly approved development branch.
  if (!inspection.enabled()) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).end();
    }
    const page = req.query?.page === 'manage' ? 'selling-vendor-manage.html' : 'selling-vendor.html';
    const html = fs.readFileSync(path.join(process.cwd(), page), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(req.method === 'HEAD' ? '' : html);
  }
  // The inspection handler chains res.status(...).send(...). Ensure that
  // status() returns the rewriting facade, not the underlying response.
  // Otherwise the original /inspect navigation escapes into Preview HTML.
  const proxy = Object.create(res);
  proxy.status = function status(code) {
    res.status(code);
    return proxy;
  };
  proxy.send = function send(body) {
    return res.send(rewriteDevelopmentHtml(body));
  };
  return inspection.createHandler()(req, proxy);
};

module.exports.rewriteDevelopmentHtml = rewriteDevelopmentHtml;
