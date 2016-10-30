/* global config, env, exports, require */
var AWS = require('aws-sdk');
AWS.config.region = config.REGION;
var dynamodb = new AWS.DynamoDB.DocumentClient();
var Sequelize = require('sequelize');


function getUser (cognitoId, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'ProjectionExpression': 'cognitoId, account',
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn('Internal Server Error:' + err);
    return user.Item ? fn(null, user.Item) : fn('Not Found: User');
  });
}


function getDrip (dripId, fn) {
  var createdAt = Number(dripId.slice(0, 13));
  var dripOwnerId = dripId.slice(13);
  dynamodb.get({'TableName': config.DDB_DRIPS_TABLE,
                'ProjectionExpression': 'ownerId, createdAt, price, revenue' +
                                        ', id, counts',
                'Key': {'ownerId': dripOwnerId, 'createdAt': createdAt}},
               function (err, drip) {
      if (err) return fn('Internal Server Error: ' + err);
      return drip.Item ? fn(null, drip.Item) : fn('Not Found: Drip');
  });
}

function updateDrip (drip, fn) {
  dynamodb.update({
    'TableName': config.DDB_DRIPS_TABLE,
    'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
    'AttributeUpdates': {
      'revenue': {'Action': 'PUT', 'Value': drip.revenue}
    }
  }, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    return fn(null, data);
  });
}

function updateUser (user, fn) {
  dynamodb.update({
    'TableName': config.DDB_USERS_TABLE,
    'Key': {'cognitoId': user.cognitoId},
    'AttributeUpdates': {
      'account': {'Action': 'PUT', 'Value': user.account}
    }
  }, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    return fn(null, data);
  });
}

function getUsersAndDrip (cognitoId, dripId, fn) {
  getUser(cognitoId, function (b_error, buyer) {
    if (b_error) return fn(b_error);
    getDrip(dripId, function (err, drip) {
      if (err) return fn(err);
      getUser(drip.ownerId, function (o_error, owner) {
        if (o_error) return fn(o_error);
        fn(null, buyer, owner, drip);
      });
    });
  });

}

function logPurchase (purchase, fn) {
  var sequelize = new Sequelize(env.MYSQL_NAME, env.MYSQL_USER,
                                env.MYSQL_PASS, {
    'host': env.MYSQL_HOST,
    'port': env.MYSQL_PORT
  });

  var Purchase = sequelize.define('purchase', {
    'buyer': Sequelize.STRING,
    'owner': Sequelize.STRING,
    'drip': Sequelize.STRING,
    'exchangeRate': Sequelize.FLOAT,
    'dripcoins': Sequelize.INTEGER,
    'dollarCents': Sequelize.INTEGER
  });
  Purchase.create(purchase).then(function (instance) {
    var recorded = instance.dataValues;
    delete recorded.id;
    delete recorded.updatedAt;
    sequelize.close();
    return fn(null, recorded);
  });
}

function updateAll (buyer, owner, drip, purchase, fn) {
  updateUser(buyer, function (b_err) {
    if (b_err) return fn(b_err);
    updateUser(owner, function (o_err) {
      if (o_err) return fn(o_err);
      updateDrip(drip, function (d_err) {
        if (d_err) return fn(d_err);
        logPurchase(purchase, function (l_err, recorded) {
          if (l_err) return fn(l_err);
          return fn(null, recorded);
        });
      });
    });
  });
}

function assertHasNotBeenPurchased (buyer, drip, fn) {
  var sequelize = new Sequelize(env.MYSQL_NAME, env.MYSQL_USER,
                                env.MYSQL_PASS, {
    'host': env.MYSQL_HOST,
    'port': env.MYSQL_PORT
  });
  var Purchase = sequelize.define('purchase', {
    'buyer': Sequelize.STRING,
    'owner': Sequelize.STRING,
    'drip': Sequelize.STRING,
    'exchangeRate': Sequelize.FLOAT,
    'dripcoins': Sequelize.INTEGER,
    'dollarCents': Sequelize.INTEGER
  });
  Purchase.findAll({
    'attributes': ['drip'],
    'where': {'buyer': buyer.cognitoId, 'drip': drip.id},
    'raw': true
  }).then(function (data) {
    sequelize.close();
    if (data.length !== 0) {
      return fn('Forbidden: drip has already been purchased by user');
    }
    return fn();
  });
}

function calculateRevenues (buyer, owner, drip, fn) {
  var purchase;
  var now = new Date().getTime();
  var exchangeRate = parseFloat(config.CENTS_PER_DRIPCOIN);
  var price = drip.price;
  var revenue = Math.round(exchangeRate * price);
  if (buyer.account.balance.dripcoins < price) {
    return fn("Forbidden: Insufficient funds");
  }
  buyer.account.purchases += 1;
  buyer.account.balance.dripcoins -= price;
  owner.account.sales += 1;
  owner.account.revenue.dripcoins += price;
  owner.account.revenue.dollarCents += revenue;
  owner.account.balance.dollarCents += revenue;
  drip.revenue.sales += 1;
  drip.revenue.dripcoins += price;
  drip.revenue.dollarCents += revenue;
  drip.counts.purchased += 1;
  purchase = {'buyer': buyer.cognitoId, 'owner': owner.cognitoId,
              'drip': drip.id, 'at': now, 'exchangeRate': exchangeRate,
              'dripcoins': price, 'dollarCents': revenue};
  return fn(null, purchase);
}

exports.handler = function (event, context) {
  var dripId = decodeURIComponent(event.dripId);
  var cognitoId = event.identity.id;
  if (typeof dripId === 'undefined' || typeof cognitoId === 'undefined') {
    return context.fail('Bad Request: Missing parameters');
  }
  getUsersAndDrip(cognitoId, dripId, function (err, buyer, owner, drip) {
    if (err) return context.fail(err);
    if (buyer.cognitoId === owner.cognitoId) {
      return context.fail('Forbidden: cannot buy own drip');
    }
    assertHasNotBeenPurchased(buyer, drip, function (a_err) {
      if (a_err) return context.fail(a_err);
      calculateRevenues(buyer, owner, drip, function (error, purchase) {
        if (error) context.fail(error);
        updateAll(buyer, owner, drip, purchase, function (u_err, recorded) {
          if (u_err) context.fail(u_err);
          context.succeed({"purchase": recorded});
        });
      });
    });
  });
};
