/* global config, env, exports, require */

// dependencies
var AWS = require('aws-sdk');
AWS.config.region = config.REGION;
var _ = require('lodash');
var Sequelize = require('sequelize');
var dynamodb = new AWS.DynamoDB.DocumentClient();
var limit = 10;

function getVotesMap (cognitoId, drips, fn) {
  var keys = _.map(drips, function (drip) {
    return {"ownerId": cognitoId, "dripId": drip.id};
  });
  var request = {'RequestItems': {}};
  request.RequestItems[config.DDB_VOTES_TABLE] = {
    'Keys': keys
  };
  dynamodb.batchGet(request, function (err, response) {
    if (err) return fn('Internal Server Error: ' + err);
    var votes = response.Responses[config.DDB_VOTES_TABLE];
    var votesMap = _.indexBy(votes, 'dripId');
    return fn(null, votesMap);
  });
}

function getPurchasesMap (cognitoId, drips, fn) {
  var dripIds = _.pluck(drips, 'id');
  var sequelize = new Sequelize(env.MYSQL_NAME, env.MYSQL_USER,
                                env.MYSQL_PASS, {
    'host': env.MYSQL_HOST,
    'port': env.MYSQL_PORT,
    'logging': false
  });
  var Purchase = sequelize.define('purchase', {
    'buyer': Sequelize.STRING,
    'drip': Sequelize.STRING
  });
  var params = {
    'attributes': ['drip'],
    'where': {'buyer': cognitoId, 'drip': {'$in': dripIds}},
    'raw': true
  };
  Purchase.findAll(params).then(function (data) {
    var purchaseMap = _.indexBy(data, 'drip');
    sequelize.close();
    return fn(null, purchaseMap);
  }).catch(function (err) {
    return fn(err);
  });
}

function getOwnersMap (owners, fn) {
  owners = _.uniq(owners);
  var cognitoIds = _.map(owners, function (n) {
    return {"cognitoId": n};
  });
  var request = {'RequestItems': {}};
  request.RequestItems[config.DDB_USERS_TABLE] = {
    'Keys': cognitoIds,
    'ProjectionExpression': 'cognitoId, profilePhoto, username'
  };
  dynamodb.batchGet(request, function (err, response) {
    if (err) return fn('Internal Server Error: ' + err);
    var users = response.Responses[config.DDB_USERS_TABLE];
    var userMap = _.indexBy(users, 'cognitoId');
    return fn(null, userMap);
  });
}

function addOwnerData (drips, fn) {
  var owners = _.pluck(drips, 'ownerId');
  getOwnersMap(owners, function (err, ownersMap) {
    if (err) return fn(err);
    drips.forEach(function (drip) {
      if (!ownersMap[drip.ownerId]) {
        return fn('Internal Server Error: User ' + drip.ownerId +
                  ' cannot be found on db');
      }
      drip.owner = ownersMap[drip.ownerId];
      drip.username = ownersMap[drip.ownerId].username;
    });
    return fn(null);
  });
}

function addRequestUserData (cognitoId, drips, fn) {
  getPurchasesMap(cognitoId, drips, function (p_err, purchasesMap) {
    if (p_err) return fn(p_err);
    getVotesMap(cognitoId, drips, function (v_err, votesMap) {
      if (v_err) return fn(v_err);
      drips.forEach(function (drip) {
        drip.requestorInfo = {'vote': null, 'purchased': false};
        if (votesMap[drip.id]) {
          drip.requestorInfo.vote = votesMap[drip.id];
        }
        if (purchasesMap[drip.id]) {
          drip.requestorInfo.purchased = true;
        }
      });
      fn(null);
    });
  });
}

function getFeedDripIds (lastKey, fn) {
  var cloudsearch = new AWS.CloudSearchDomain({'endpoint': config.CS_DRIPS});
  var params = {
    'query': "matchall",
    'queryParser': 'structured',
    'filterQuery': "(and deleted:0 published:1)",
    'size': limit,
    'sort': 'createdat desc'
  };
  params.cursor = lastKey ? lastKey : 'initial';
  cloudsearch.search(params, function (err, data) {
    if (err) return fn(err);
    var dripIds = _.pluck(data.hits.hit, 'id');
    var newLastKey = dripIds.length < limit ? undefined : data.hits.cursor;
    return fn(null, dripIds, newLastKey);
  });
}

function getGenericDrips (lastKey, fn) {
  getFeedDripIds(lastKey, function (err, dripIds, newLastKey) {
    if (err) return fn(err);
    if (dripIds.length === 0) return fn(null, [], 0, undefined);
    var request = {'RequestItems': {}};
    request.RequestItems[config.DDB_DRIPS_TABLE] = {
      'Keys': dripIds.map(function (d) {
          return {'createdAt': Number(d.slice(0, 13)), 'ownerId': d.slice(13)};
      }),
      'ProjectionExpression':
        'id, counts, price, ownerId, tags, createdAt, deletedAt, ' +
        'updatedAt, title, media, description, profilePhoto, publishedAt'
    };
    dynamodb.batchGet(request, function (error, data) {
      if (error) return fn('Internal Server Error: ' + error);
      var count = data.Responses.dt_drips.length;
      data.Responses.dt_drips = _.sortByOrder(data.Responses.dt_drips,
                                              'createdAt', 'desc');
      return fn(null, data.Responses.dt_drips, count, newLastKey);
    });
  });
}

exports.handler = function (event, context) {
  var lastKey = event.lastKey;
  var collection = event.collection;
  var cognitoId = event.identity.id;
  var role = event.identity.type;
  if (!collection) {
    collection = 'all';
  }

  function responseFn (err, items, count, newLastKey) {
    if (err) return context.fail(err);
    var response = {'Items': items, 'Count': count, 'LastKey': newLastKey};
    response.Collection = collection;
    if (items.length === 0) return context.succeed(response);
    response.Items.forEach(function (drip) {
      drip.createdDate = (new Date(drip.createdAt)).toISOString();
      drip.updatedDate = (new Date(drip.updatedAt)).toISOString();
      if (drip.publishedAt !== null) {
        drip.publishedDate = (new Date(drip.publishedAt)).toISOString();
      } else {
        drip.publishedDate = null;
      }
    });
    addOwnerData(response.Items, function (error) {
      if (error) return context.fail(error);
      if (collection === 'all' && role === 'authenticated') {
        addRequestUserData(cognitoId, response.Items, function (r_err) {
          if (r_err) return context.fail(r_err);
          return context.succeed(response);
        });
      } else {
        return context.succeed(response);
      }
    });
  }

  getGenericDrips(lastKey, responseFn);
};
