'use strict';
const notes = [];

function authenticate(req) {
  return req.headers['x-token'] === process.env.API_TOKEN;
}

function handle(req) {
  if (!authenticate(req)) return { status: 401 };
  if (req.method === 'GET') return { status: 200, body: notes };
  return { status: 404 };
}

module.exports = { handle };
