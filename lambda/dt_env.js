/* global exports, require */


function parseConfig (confStr) {
  var config = {};
  var envList = confStr.slice(1, confStr.length - 1).split(', ');
  envList.forEach(function (v) {
    var keyval = v.split('=');
    config[keyval[0]] = keyval[1];
  });
  return config;
}

exports.handler = function (event, context) {
  var config = parseConfig(event.config);
  if (!config.EXPOSABLE) {
    return context.fail('No exposable variables set!');
  }
  var exposable = {};
  config.EXPOSABLE.split(',').forEach(function (k) {
    exposable[k] = config[k];
  });
  return context.succeed(exposable);
};
