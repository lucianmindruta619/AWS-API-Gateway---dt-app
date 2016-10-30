console.log('Loading event');

var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();
var _ = require('lodash');

function getCognitoIds (keyword, fn) {
  var cloudsearch = new AWS.CloudSearchDomain({
    'endpoint': config.CS_USERS
  });

  var params = {
    'query': "'" + keyword + "'",
    'queryParser': 'simple',
    'sort': 'username desc'
  };

  cloudsearch.search(params, function (err, data) {
    if (err) return fn(err);
    var cognitoIds = _.pluck(data.hits.hit, 'id');

    return fn(null, cognitoIds);
  });
}

function getGenericUsers (keyword, fn) {
  getCognitoIds(keyword, function (err, cognitoIds) {
    if (err) return fn(err);
    if (cognitoIds.length === 0) return fn(null, []);

    var request = {'RequestItems': {}};
    request.RequestItems[config.DDB_USERS_TABLE] = {
      'Keys': cognitoIds.map(function (d) {
          return {'cognitoId': d}
      }),
      'ProjectionExpression':
        'bio, username, profilePhoto, coverPhoto, website, counts' +
                   ', #name, cognitoId, updatedAt',
      'ExpressionAttributeNames': {'#name': 'name'}
    };

    dynamodb.batchGet(request, function (error, data) {
      if (error) return fn('Internal Server Error: ' + error);
      data.Responses.dt_users = _.sortByOrder(data.Responses.dt_users,
                                              'createdAt', 'desc');
      return fn(null, data.Responses.dt_users);
    });
  });
}

exports.handler = function(event, context) {
  var keyword = decodeURIComponent(event.keyword);

  getGenericUsers(keyword, function (err, users) {
    if (err) return context.fail(err);

    context.succeed(users);
  });
};