/* global config, exports, require */
var AWS = require('aws-sdk');
AWS.config.region = config.REGION;
var request = require('request');
var dynamodb = new AWS.DynamoDB.DocumentClient();
var async = require('async');


function getIap (iapId, fn) {
  dynamodb.get({'TableName': config.DDB_IAP_TABLE,
                'Key': {'iapId': iapId}},
               function (err, data) {
      if (err) return fn('Internal Server Error: ' + err);
      return data.Item ? fn(null, data.Item) : fn('Not Found: IAP');
  });
}

function storeCredit (transaction, fn) {
  dynamodb.put({'TableName': config.DDB_CREDITS_TABLE,
                'Item': transaction},
               function (err) {
    if (err) return fn('Internal Server Error: ' + err);
    return fn();
  });
}

function getUser (cognitoId, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'ProjectionExpression': 'cognitoId, account',
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn('Internal Server Error:' + err);
    return user.Item ? fn(null, user.Item) : fn('Not Found: User');
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

function assertNoIosTransaction (id, fn) {
  dynamodb.query({'TableName': config.DDB_IOSRECEIPTS_TABLE,
                  'KeyConditionExpression': 'id= :tid',
                  'ExpressionAttributeValues': {':tid': id}
                 }, function (err, data) {
    if (err) return fn('Internal Server Error:' + err);
    return data.Count !== 0 ? fn('Forbidden: transaction already recorded') :
                              fn();
  });
}

function storeIosTransaction (transaction, fn) {
  getIap(transaction.inApp.product_id, function (iErr, iap) {
    if (iErr) return fn(iErr);
    transaction.dripcoins = iap.dripcoins;
    assertNoIosTransaction(transaction.id, function (err) {
      if (err) return fn(err);
      dynamodb.put({'TableName': config.DDB_IOSRECEIPTS_TABLE,
                    'Item': transaction}, function (dbErr) {
        if (dbErr) return fn('Internal Server Error:' + dbErr);
        storeCredit(transaction, function (cErr) {
          if (cErr) return fn(cErr);
          creditUser(transaction.cognitoId, transaction.dripcoins,
                     function (uErr) {
            if (uErr) return fn(uErr);
            return fn(null, transaction);
          });
        });
      });
    });
  });
}

function creditUser (cognitoId, dripcoins, fn) {
  getUser(cognitoId, function (gErr, user) {
    if (gErr) return fn(gErr);
    user.account.balance.dripcoins += dripcoins;
    updateUser(user, function (uErr) {
      if (uErr) return fn(uErr);
      return fn(null);
    });
  });
}

function validateIosReceipt (receipt, fn) {
  var params = {
    'method': 'POST',
    'uri': 'https://sandbox.itunes.apple.com/verifyReceipt',
    'body': {'receipt-data': receipt},
    'json': true
  };
  request(params, function (error, response, body) {
    if (error) return fn(error);
    if (body.status !== 0) return fn('Forbidden: receipt status ' +
                                     body.status);
    return fn(null, body.receipt);
  });
}

function parseIosTransactions (cognitoId, receipt) {
  var transactions = [];
  var now = new Date().getTime();
  transactions = receipt.in_app.map(function (rpt) {
    return {'id': rpt.transaction_id,
             'platform': 'ios',
             'cognitoId': cognitoId,
             'createdAt': now,
             'inApp': rpt};
  });
  return transactions;
}

exports.handler = function (event, context) {
  var receiptHash = event.receipt;
  var platform = event.platform;
  var cognitoId = event.identity.id;
  if (platform === 'ios') {
    if (!receiptHash) {
      return context.fail('Bad Request: Missing receipt');
    }
    validateIosReceipt(receiptHash, function (iosErr, receipt) {
      if (iosErr) return context.fail(iosErr);
      var transactions = parseIosTransactions(cognitoId, receipt);
      transactions.push(transactions[0]);
      async.mapSeries(transactions, function (tr, callback) {
        storeIosTransaction(tr, function (err) {
          if (err) {
            var toReturn = {'errorMessage': err, 'inApp': tr.inApp};
            if (err === 'Forbidden: transaction already recorded') {
              toReturn.prerecorded = true;
            }
            return callback(null, toReturn);
          }
          callback(null, tr);
        });
      }, function (trErr, results) {
        if (trErr) return context.fail(trErr);
        return context.succeed({'ios': receipt, 'transactions': results});
      });
    });
  }
  else {
    return context.fail('Bad Request: missing platform parameter');
  }
};
