/* global config, exports, require */

// dependencies
var AWS = require('aws-sdk');
AWS.config.region = config.REGION;
var dynamodb = new AWS.DynamoDB.DocumentClient();


function getIaps (fn) {
  var params = {
    'TableName': config.DDB_IAP_TABLE
  };
  dynamodb.scan(params, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    return fn(null, data.Items);
  });
}

exports.handler = function (event, context) {
  getIaps(function (err, items) {
    if (err) return context.fail(err);
    return context.succeed(items);
  });
};
