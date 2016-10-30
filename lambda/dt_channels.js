/* global config, exports, require */

// dependencies
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();


function getChannels (fn) {
  dynamodb.scan({
    'TableName': config.DDB_CHANNELS_TABLE,
    'Limit': 100
  }, function (err, drips) {
    if (err) return fn('Internal Server Error: ' + err);
    else fn(null, drips.Items);
  });
}

exports.handler = function (event, context) {
  getChannels(function (err, drips) {
    if (err) return context.fail(err);
    return context.succeed(drips);
  });
};
