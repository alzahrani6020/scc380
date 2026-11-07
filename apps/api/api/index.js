const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const expressModule = require('express');
const serverlessModule = require('serverless-http');
const { AppModule } = require('../dist/app.module.js');

const express = expressModule.default || expressModule;
const serverless = serverlessModule.default || serverlessModule;

let cachedHandler;

async function bootstrap() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  await app.init();
  return serverless(server);
}

module.exports = async (req, res) => {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }
  return cachedHandler(req, res);
};
