/* global config, exports, require */

// dependencies
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();


exports.handler = function (event, context) {
  toReturn = {
    'vartype': typeof event.config,
    'config': event.config
  }
  context.succeed(toReturn);
};
