const fs = require('fs');
const http = require('http');
const promisify = require('util').promisify;
const [readFile, writeFile] = [promisify(fs.readFile), promisify(fs.writeFile)];
const express = require('express');

const ports = [11080, 12080];
const ENABLE_LOGGING = false;

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
              status: resp.statusCode
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
    .listen(port + 1);
}

let mockData = {};
let currentUsername = '';

function addData({ username, path, method, body, status }) {
  path_method_key = `${path}_${method}`;
  mockData = {
    ...mockData,
    [username]: {
      ...mockData[username],
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

const MOCK_DATA_FILE_NAME = 'mock-data.json';

async function addToMock(data) {
  let oldData = JSON.parse(await readFile(MOCK_DATA_FILE_NAME, 'utf8'));
  const newData = { ...oldData, ...data };
  await writeFile(MOCK_DATA_FILE_NAME, JSON.stringify(newData), 'utf8');
}
