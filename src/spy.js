const fs = require('fs');
const http = require('http');
const promisify = require('util').promisify;
const [readFile, writeFile] = [promisify(fs.readFile), promisify(fs.writeFile)];
const express = require('express');
const argv = require('minimist')(process.argv.slice(2));
const _merge = require('lodash.merge')

const ports = argv._;
const ENABLE_LOGGING = argv.debug && console.log('Debugging enabled!');

ports.forEach(p => createProxy(p));

function createProxy(port) {
  return express()
    .use(express.json())
    .all('*', (request, response) => {
      console.log(request.url);

      const options = {
        hostname: request.hostname,
        port: port,
        path: request.path,
        method: request.method,
        headers: {
          cookie: request.headers.cookie || '',
          'content-type': 'application/json'
        }
      };

      log(request.headers, 'REQUEST HEADERS');

      http
        .request(options, resp => {
          response.set(resp.headers);
          response.status(resp.statusCode);
          resp.pipe(response);
          resp.on('data', body =>
            addData({
              username: currentUsername,
              path: request.path,
              method: request.method,
              body: JSON.parse(body.toString()),
              status: resp.statusCode,
              cookie: getCookie(resp.headers['set-cookie'], 'wemoui')
            })
          );

          log(resp.headers, 'SERVICE RESP HEADERS');
        })
        .on('error', e => console.log('Response error ', e))
        .end(JSON.stringify(request.body));

      if (!!request.body.username && request.body.username !== currentUsername) {
        currentUsername = request.body.username;
      }
      log(request.body, 'REQUEST BODY');
    })
    .listen(port + 1, () => console.log(`*** Listening on port: ${port + 1}, spying on port ${port}. ***`));
}

let mockData = {};
let currentUsername = '';

function addData({ username, path, method, body, status, cookie }) {
  path_method_key = `${path}_${method}`;
  mockData = {
    ...mockData,
    [username]: {
      ...mockData[username],
      wemouiCookie: cookie,
      [path_method_key]: {
        body,
        status
      }
    }
  };
  addToMock(mockData);
}

function log(data, name, override) {
  if (!ENABLE_LOGGING && !override) return;
  console.log(`-----${name}-----`);
  console.log(data);
  console.log('-----------------');
}

const MOCK_DATA_FILE_NAME = __dirname + '/mock-data.json';

async function addToMock(data) {
  let oldData = JSON.parse(await readFile(MOCK_DATA_FILE_NAME, 'utf8'));
  const newData = _merge(oldData, data);
  await writeFile(MOCK_DATA_FILE_NAME, JSON.stringify(newData), 'utf8');
}

function getCookie(cookies, name) {
  const c = cookies.find(c => c.startsWith('wemoui'));
  const match = c && c.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return JSON.parse(decodeURIComponent(match[2]));
}