const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  url: require.resolve('url'),
  events: require.resolve('events'),
  https: require.resolve('https-browserify'),
  http: require.resolve('http-browserify'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer'),
  process: require.resolve('process/browser'),
  util: require.resolve('util'),
  crypto: require.resolve('crypto-browserify'),
  os: require.resolve('os-browserify/browser'),
  path: require.resolve('path-browserify'),
  assert: require.resolve('assert'),
  querystring: require.resolve('querystring-es3'),
};

module.exports = config;
