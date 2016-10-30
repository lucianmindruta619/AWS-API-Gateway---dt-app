/* global config, exports, require */
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();


function createCapture (ownerId, dripId, fn) {
  var now = new Date().getTime();
  var cap_data = {'ownerId': ownerId,
          'dripId': dripId,
          'createdAt': now
  };
  dynamodb.put({
    'TableName': config.DDB_CAPTURED_TABLE,
    'Item': cap_data,
    'ConditionExpression': 'NOT (attribute_exists (ownerId) ' +
                           'AND attribute_exists (dripId))'
  }, function (err, data) {
    if (err) {
      if (err.code === 'ConditionalCheckFailedException') {
        return fn('Forbidden: Drip already captured');
      }
      return fn('Internal Server Error: ' + err);
    }
    return fn(null, data);
  });
}

exports.handler = function (event, context) {
  var dripId = decodeURIComponent(event.dripId);
  var cognitoId = event.identity.id;
  if (typeof dripId === 'undefined' || typeof cognitoId === 'undefined') {
    return context.fail('Bad Request: Missing parameters');
  }
  var dripOwnerId = dripId.slice(13);
  if (cognitoId === dripOwnerId) {
    return context.fail('Forbidden: cannot capture own drip');
  }
  createCapture(cognitoId, dripId, function (err) {
    if (err) return context.fail(err);
    return context.succeed({'captured': true});
  });

};
