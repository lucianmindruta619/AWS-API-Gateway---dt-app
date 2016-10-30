/* global config, exports, require */
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();

function assertNoUsername (username, fn) {
  dynamodb.get({'TableName': config.DDB_USERNAMES_TABLE,
                'Key': {'username': username}}, function (err, user) {
    if (err) return fn('Internal Server Error:' + err);
    return user.Item ? fn('Forbidden: User ' + username + ' exists') : fn();
  });
}

function storeUsername (username, cognitoId, fn) {
  dynamodb.put({
    'TableName': config.DDB_USERNAMES_TABLE,
    'Item': {'username': username, 'cognitoId': cognitoId},
    'ConditionExpression': 'attribute_not_exists (username)'
  }, function (err) {
    if (err) {
      if (err.code === 'ConditionalCheckFailedException') {
        return fn('Forbidden: Username ' + username + ' exists');
      }
      return fn('Internal Server Error: ' + err);
    }
    return fn();
  });
}

function getUser (cognitoId, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'ProjectionExpression': 'bio, username, profilePhoto, ' +
                                        'coverPhoto, website, counts, ' +
                                        'cognitoId, #name, paypal',
                'ExpressionAttributeNames': {'#name': 'name'},
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn('Internal Server Error: ' + err);
    return user.Item ? fn(null, user.Item) : fn('Not Found: User');
  });
}

function updateUser (user, toUpdate, fn) {
  var key, updates = {};
  for (key in toUpdate) {
    if (toUpdate.hasOwnProperty(key)) {
      updates[key] = {'Action': 'PUT', 'Value': toUpdate[key]};
    }
  }
  var now = new Date().getTime();
  updates.updatedAt = {'Action': 'PUT', 'Value': now};
  dynamodb.update({
    'TableName': config.DDB_USERS_TABLE,
    'Key': {'cognitoId': user.cognitoId},
    'AttributeUpdates': updates
  }, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    if (typeof toUpdate.username !== 'undefined') {
      storeUsername(toUpdate.username, user.cognitoId, function (uErr) {
        if (uErr) return fn(uErr);
        return fn(null, data);
      });
    }
    return fn(null, data);
  });
}


function validate (event, fn) {
  var data = event.to_update;
  var now = new Date().getTime();
  event.userId = decodeURIComponent(event.userId);
  if (event.requestUser !== event.userId) {
     return fn("Forbidden: User has no access to this profile");
  }

  getUser(event.requestUser, function (err, user) {
    var toUpdate = {};
    var empty = true;
    if (err) return fn(err);
    ['name', 'bio', 'username', 'website', 'dob', 'cell',
     'profilePhoto', 'coverPhoto', 'paypal', 'sex'].forEach(
      function (field) {
        if (typeof data[field] !== 'undefined') {
          empty = false;
          if (data[field]) {
            toUpdate[field] = data[field];
          } else {
            toUpdate[field] = null;
          }
        }
      });
    if (empty) {
      return fn('Bad Request: Nothing to update');
    }
    toUpdate.updatedAt = now;
    if (typeof toUpdate.username !== 'undefined') {
      assertNoUsername(toUpdate.username, function (uErr) {
        if (uErr) return fn(uErr);
        return fn(null, user, toUpdate);
      });
    }
    return fn(null, user, toUpdate);
  });
}


exports.handler = function (event, context) {
  event.requestUser = event.identity.id;
  delete event.identity;
  validate(event, function (error, user, toUpdate) {
    if (error) return context.fail(error);
    updateUser(user, toUpdate, function (err) {
      if (err) return context.fail(err);
      context.succeed({'updated': toUpdate});
    });
  });
};
