'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Canonical Selling Vendor pages always load the real authenticated workspace.
// Preview inspection is served only through the separate /inspect endpoints.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const page = req.query?.page === 'manage' ? 'selling-vendor-manage.html' : 'selling-vendor.html';
  const html = fs.readFileSync(path.join(process.cwd(), page), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).send(req.method === 'HEAD' ? '' : html);
};
