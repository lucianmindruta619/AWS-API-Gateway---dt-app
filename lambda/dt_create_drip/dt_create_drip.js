/* global config, exports, require */
var AWS = require('aws-sdk');
AWS.config.region = config.REGION;
var dynamodb = new AWS.DynamoDB.DocumentClient();
var Hashids = require('hashids');

function shortId (dripId) {
  var sep = config.HASHIDS_SEPARATOR;
  var hashids = new Hashids(config.HASHIDS_SALT, 0, config.HASHIDS_ALPHABET);
  var createdAt = Number(dripId.slice(0, 13));
  var createdAtEnc = hashids.encode(createdAt);

  var ownerId = dripId.slice(23);
  var parts = ownerId.split('-');
  var partsEnc = parts.map(function (p) { return hashids.encodeHex(p); });
  var hash = createdAtEnc + sep + partsEnc.join(sep);
  return hash;
}

function getUser (cognitoId, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'ProjectionExpression': 'bio, username, profilePhoto, ' +
                                        'coverPhoto, website, counts, ' +
                                        'cognitoId, #name',
                'ExpressionAttributeNames': {'#name': 'name'},
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn('Internal Server Error: ' + err);
    return user.Item ? fn(null, user.Item) : fn('Not Found: User');
  });
}

function updateUser (user, fn) {
  dynamodb.update({
    'TableName': config.DDB_USERS_TABLE,
    'Key': {'cognitoId': user.cognitoId},
    'AttributeUpdates': {
      'counts': {'Action': 'PUT', 'Value': user.counts}
    }
  }, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    return fn(null, data);
  });
}


function validate (data, fn) {
  var now = new Date().getTime();
  if (!data.title) return fn('Bad Request: Title cannot be empty');
  if (!data.ownerId) return fn('Bad Request: Owner cannot be empty');

  getUser(data.ownerId, function (err, user) {
    if (err) return fn(err);
    data.id = now + data.ownerId;
    data.price = Number(data.price);
    data.createdAt = now;
    data.updatedAt = now;
    data.publishedAt = null;
    data.shortId = shortId(data.createdAt + data.ownerId);
    data.tags = [];
    data.media = [];
    data.counts = {'purchased': 0, 'mediasAttached': 0, 'upVotes': 0,
                   'downVotes': 0, 'rating': 0, 'reports': 0};
    data.revenue = {'sales': 0, 'dripcoins': 0, 'dollarCents': 0};
    data.username = user.username;
    return fn(null, user, data);
  });
}

function storeDrip (drip, fn) {
  dynamodb.put({
    'TableName': config.DDB_DRIPS_TABLE,
    'Item': drip,
    'ConditionExpression':
      'NOT (attribute_exists(ownerId) AND attribute_exists(dripId))'
  }, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    dynamodb.put({
      'TableName': config.DDB_FEEDS_TABLE,
      'Item': {'set': 'default', 'dripId': drip.id}
    }, function (fErr) {
      if (fErr) return fn('Internal Server Error: ' + err);
      return fn(null, data);
    });
  });
}


exports.handler = function (event, context) {
  var input = {'ownerId': event.identity.id, 'title': event.title,
               'description': event.description, 'price': event.price};
  validate(input, function (error, user, drip) {
    if (error) return context.fail(error);
    storeDrip(drip, function (err) {
      if (err) return context.fail(err);
      user.counts.createdDrips += 1;
      updateUser(user, function (user_error) {
        if (user_error) return context.fail(err);
        context.done(null, {"created": drip});
      });
    });
  });
};
