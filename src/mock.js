const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const argv = require('minimist')(process.argv.slice(2));

const MOCK_DATA_FILE_NAME = 'mock-data.json';

const ports = argv._;

console.log('...loading data...');
var mockData = JSON.parse(fs.readFileSync(MOCK_DATA_FILE_NAME, 'utf8'));
console.log('Mock data loaded!');

ports.forEach(createMockServer);

function createMockServer(port) {
  express()
    .use(express.json())
    .use(cookieParser())
    .all('*', (request, response) => {
      const username = request.body.username || request.cookies.username;

      if (!username) {
        response.status(404);
        const errorMsg =
          'Error!! No username specified! A username should be either in ' +
          'the cookie (e.g. "username=123456789") or in the request body ' +
          'in case of a login request';
        console.log(errorMsg);
        response.end(errorMsg);
        return;
      }

      const userMockData = mockData[username];

      if (!userMockData) {
        response.status(404);
        const errorMsg = `Error!! No mock data exists for this user: ${username}`;
        console.log(errorMsg);
        response.end(errorMsg);
        return;
      }

      const key = `${request.path}_${request.method}`;
      const { body, status } = userMockData[key];

      if (!body || !status) {
        const errorMsg = `Error!! No data exists for this path_method: ${key}`;
        console.log(errorMsg);
        response.status(404);
        response.end(errorMsg);
        return;
      }

      response.cookie('wemoui', JSON.stringify(userMockData['wemouiCookie']));
      response.cookie('username', username);
      response.status(status);
      response.end(JSON.stringify(body));
    })
    .listen(port);
}

const ENABLE_LOGGING = true;

function log(data, name, override) {
  if (!ENABLE_LOGGING && !override) return;
  console.log(`-----${name}-----`);
  console.log(data);
  console.log('-----------------');
}