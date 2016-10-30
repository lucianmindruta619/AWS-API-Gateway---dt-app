/* global config, exports, require */

// dependencies
var AWS = require('aws-sdk');
AWS.config.region = config.REGION;
var dynamodb = new AWS.DynamoDB.DocumentClient();
var limit = 10;


function getCredits (cognitoId, lastKey, fn) {
  var params = {
    'TableName': config.DDB_CREDITS_TABLE,
    'KeyConditionExpression': 'cognitoId=:cognitoId',
    'ExpressionAttributeValues': {':cognitoId': cognitoId},
    'ScanIndexForward': false,
    'Limit': limit
  };
  if (lastKey) {
    params.ExclusiveStartKey = {'cognitoId': lastKey.slice(13),
                                'createdAt': Number(lastKey.slice(0, 13))};
  }
  dynamodb.query(params, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    var newLastKey;
    if (data.LastEvaluatedKey) {
      newLastKey = data.LastEvaluatedKey.createdAt +
        data.LastEvaluatedKey.cognitoId;
    }
    return fn(null, data.Items, data.Count, newLastKey);
  });
}

exports.handler = function (event, context) {
  var lastKey = event.lastKey;
  var cognitoId = event.identity.id;
  getCredits(cognitoId, lastKey, function (err, items, count, newLastKey) {
    if (err) return context.fail(err);
    var response = {'Items': items, 'Count': count, 'LastKey': newLastKey};
    response.Items.forEach(function (credit) {
      credit.createdDate = (new Date(credit.createdAt)).toISOString();
    });
    return context.succeed(response);
  });
};
