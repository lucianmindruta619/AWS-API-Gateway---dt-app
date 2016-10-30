/* global config, env, exports, require */
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();
var Sequelize = require('sequelize');


function getPurchase (cognitoId, drip, fn) {
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
    'where': {'buyer': cognitoId, 'drip': drip.id},
    'raw': true
  };
  Purchase.find(params).then(function (data) {
    sequelize.close();
    return fn(null, data);
  }).catch(function (err) {
    return fn(err);
  });
}

function getVote (cognitoId, drip, fn) {
  dynamodb.get({'TableName': config.DDB_VOTES_TABLE,
                'Key': {'ownerId': cognitoId, 'dripId': drip.id}},
               function (err, vote) {
      if (err) return fn('Internal Server Error: ' + err);
      return vote.Item ? fn(null, vote.Item) : fn();
  });
}

function addRequestUserData (cognitoId, drip, fn) {
  getPurchase(cognitoId, drip, function (p_err, purchase) {
    if (p_err) return fn(p_err);
    getVote(cognitoId, drip, function (v_err, vote) {
      if (v_err) return fn(v_err);
      drip.requestorInfo = {'vote': vote, 'purchased': false};
      if (purchase) drip.requestorInfo.purchased = true;
      fn(null);
    });
  });
}

function getDrip (dripId, ownerId, fn) {
  var createdAt = Number(dripId.slice(0, 13));
  var dripOwnerId = dripId.slice(13);
  // if (dripOwnerId !== ownerId) return fn('User cannot access this drip');
  dynamodb.get({'TableName': config.DDB_DRIPS_TABLE,
                'ProjectionExpression':
                  'id, counts, price, ownerId, tags, createdAt, ' +
                  'updatedAt, title, media, description, profilePhoto, ' +
                  'publishedAt',
                'Key': {'ownerId': dripOwnerId, 'createdAt': createdAt}},
               function (err, drip) {
      if (err) return fn('Internal Server Error: ' + err);
      return drip.Item ? fn(null, drip.Item) : fn('Not Found: Drip');
  });
}

function addUserData (drip, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'Key': {'cognitoId': drip.ownerId},
                'ProjectionExpression': 'profilePhoto, username'},
                function (err, user) {
    if (err) return fn('Internal Server Error: ' + err);
    drip.owner = user.Item;
    drip.username = user.Item.username;
    return fn(null);
  });
}

exports.handler = function (event, context) {
  var dripId = decodeURIComponent(event.dripId);
  var cognitoId = event.identity.id;
  var role = event.identity.type;
  getDrip(dripId, cognitoId, function (err, drip) {
    if (err) return context.fail(err);
    drip.createdDate = (new Date(drip.createdAt)).toISOString();
    drip.updatedDate = (new Date(drip.updatedAt)).toISOString();
    if (drip.publishedAt !== null) {
      drip.publishedDate = (new Date(drip.publishedAt)).toISOString();
    } else {
      drip.publishedDate = null;
    }
    addUserData(drip, function (error) {
      if (error) return context.fail(error);
      if (role === 'authenticated') {
        addRequestUserData(cognitoId, drip, function (r_err) {
          if (r_err) context.fail(r_err);
          context.succeed(drip);
        });
      } else {
        context.succeed(drip);
      }
    });
  });
};
