/* global config, exports, require */

// dependencies
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();
var _ = require('lodash');

function parseConfig(configStr) {
  var config = {};
  var params = configStr.slice(1, config.length - 1).split(',');
  params.forEach(function (p) {
    key, val = p.trim.split('=');
  });

}

exports.handler = function (event, context) {
  var config = parseConfig(event.config);
  context.done('panos');
};
