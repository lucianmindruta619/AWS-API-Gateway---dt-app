/* global console, process, require */

var gulp = require('gulp');
var AWS = require('aws-sdk');
var async = require('async');
var Sequelize = require('sequelize');
var config = require('../scripts/config.json');
var _ = require('lodash');
AWS.config.update({'region': 'us-east-1'});
var dynamodb = new AWS.DynamoDB.DocumentClient();
require('dotenv').load();


gulp.task('db-migrate-purchases', function () {
  var sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER,
                                process.env.DB_PASS, {
    'host': process.env.DB_HOST,
    'port': process.env.DB_PORT,
    'logging': false
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
    'raw': true
  }).then(function (data) {
    sequelize.close();
    var mapped = _.map(data, function (p) {
      return {'buyerId': p.buyer,
              'ownerId': p.owner,
              'dripId': p.drip,
              'dripcoins': p.dripcoins,
              'dollarCents': p.dollarCents,
              'createdAt': p.createdAt.getTime()};
    });
    mapped.forEach(function (p) {
      dynamodb.put({'TableName': 'dt_purchases',
                    'Item': p},
                   function (err) {
                     console.log(err);
                   });
    });
  });
});

gulp.task('db-get-purchased2', function () {
  var sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER,
                                process.env.DB_PASS, {
    'host': process.env.DB_HOST,
    'port': process.env.DB_PORT
  });
  var buyer = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';
  var Purchase = sequelize.define('purchase', {
    'buyer': Sequelize.STRING,
    'drip': Sequelize.STRING
  });
  var dripIds = ['1450479346223us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09',
    '1450868271287us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09',
    '1450868296077us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09',
    '1451427425472us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09',
    '1450656450580us-east-1:399b8a0e-33da-4566-b3bb-b7ea2aa9439e',
    '1450721758088us-east-1:399b8a0e-33da-4566-b3bb-b7ea2aa9439e',
    '1450727595140us-east-1:399b8a0e-33da-4566-b3bb-b7ea2aa9439e',
    '1450734832323us-east-1:399b8a0e-33da-4566-b3bb-b7ea2aa9439e',
    '1450807619997us-east-1:399b8a0e-33da-4566-b3bb-b7ea2aa9439e',
    '1450813522355us-east-1:399b8a0e-33da-4566-b3bb-b7ea2aa9439e'];
  var params = {
    'attributes': ['drip'],
    'where': {'buyer': buyer, 'drip': {'$in': dripIds}},
    'raw': true
  };
  Purchase.findAll(params).then(function (data) {
    console.log(data);
    var purchaseMap = _.indexBy(data, 'drip');
    sequelize.close();
  }).catch(function (err) {
    console.log(err);
  });
});

gulp.task('db-get-purchased', function () {
  var sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER,
                                process.env.DB_PASS, {
    'host': process.env.DB_HOST,
    'port': process.env.DB_PORT
  });
  var buyer = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';
  var Purchase = sequelize.define('purchase', {
    'buyer': Sequelize.STRING,
    'drip': Sequelize.STRING
  });
  Purchase.findAll({
    'attributes': ['drip'],
    'where': {'buyer': buyer},
    'raw': true
  }).then(function (data) {
      var dripIds = _.map(data, function (n) {
        return {'createdAt': Number(n.drip.slice(0, 13)),
                'ownerId': n.drip.slice(13)};
      });
      console.log(dripIds);
      sequelize.close();
  });
});

gulp.task('db-make-purchase', function () {
  var sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER,
                                process.env.DB_PASS, {
    'host': process.env.DB_HOST,
    'port': process.env.DB_PORT
  });

  var purchase = {'owner': 'owner', 'buyer': 'buyer', 'drip': 'drip',
                  'exchangeRate': 0.4, 'dripcoins': 5, 'dollarCents': 15};

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
      console.log(recorded);
      sequelize.close();
    });
});

gulp.task('db-create-registered', function () {
  var sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER,
                                process.env.DB_PASS, {
    'host': process.env.DB_HOST,
    'port': process.env.DB_PORT
  });

  var User = sequelize.define('registration', {
    'cognitoId': Sequelize.STRING,
    'email': Sequelize.STRING,
    'username': Sequelize.STRING,
    'passwordHash': Sequelize.STRING,
    'verified': Sequelize.BOOLEAN,
    'verifyToken': Sequelize.STRING
  });

  dynamodb.scan({
    'TableName': 'dt_registered',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      User.sync().then(function () {
        User.bulkCreate(data.Items);
        sequelize.close();
      });
    }
  });

});

gulp.task('db-add-paypal', function () {
  dynamodb.scan({
    'TableName': 'dt_users',
    'ProjectionExpression': 'cognitoId',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (user) {
        var paypal = null;
        dynamodb.update({
          'TableName': 'dt_users',
          'Key': {'cognitoId': user.cognitoId},
          'AttributeUpdates': {'paypal': {'Action': 'PUT', 'Value': paypal}}
        }, function (error) {
          if (error) console.log(error);
          console.log(user);
        });
      });
    }
  });
});

gulp.task('db-add-account', function () {
  dynamodb.scan({
    'TableName': 'dt_users',
    'ProjectionExpression': 'cognitoId, account',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (user) {
        if (!user.account.revenue.dollarCents) {
          if (user.account.revenue.dollars) {
            user.account.revenue.dollarCents = user.account.revenue.dollars;
          } else {
            user.account.revenue.dollarCents = 0;
          }
        }
        delete user.account.revenue.dollars;
        dynamodb.update({
          'TableName': 'dt_users',
          'Key': {'cognitoId': user.cognitoId},
          'AttributeUpdates': {'account': {'Action': 'PUT', 'Value': user.account}}
        }, function (error) {
          if (error) console.log(error);
          console.log(user);
        });
      });
    }
  });
});

gulp.task('db-add-drip-revenue', function () {
  dynamodb.scan({
    'TableName': 'dt_drips',
    'ProjectionExpression': 'ownerId, createdAt',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (drip) {
        var revenue = {'sales': 0, 'dripcoins': 0, 'dollarCents': 0};
        if (drip.revenue) return;
        dynamodb.update({
          'TableName': 'dt_drips',
          'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
          'AttributeUpdates': {'revenue': {'Action': 'PUT', 'Value': revenue}}
        }, function (error) {
          if (error) console.log(error);
          console.log(drip);
        });
      });
    }
  });
});


gulp.task('db-rename-counts', function () {
  dynamodb.scan({
    'TableName': 'dt_drips',
    'ProjectionExpression': 'ownerId, createdAt, counts',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (drip) {
        var count = 0;
        if (typeof drip.counts.purchasedCount !== 'undefined') {
          count = drip.counts.purchasedCount;
          delete drip.counts.purchasedCount;
        }
        if (typeof drip.counts.purchased !== 'undefined') {
          count = drip.counts.purchased;
        }
        drip.counts.purchased = count;
        dynamodb.update({
          'TableName': 'dt_drips',
          'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
          'AttributeUpdates': {'counts': {'Action': 'PUT',
                                          'Value': drip.counts}}
        }, function (error) {
          if (error) console.log(error);
          console.log(drip);
        });
      });
    }
  });
});

gulp.task('db-create-registered', function () {
  var sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER,
                                process.env.DB_PASS, {
    'host': process.env.DB_HOST,
    'port': process.env.DB_PORT
  });

  var User = sequelize.define('registered', {
    'cognitoId': Sequelize.STRING,
    'email': Sequelize.STRING,
    'username': Sequelize.STRING,
    'passwordHash': Sequelize.STRING,
    'verified': Sequelize.BOOLEAN,
    'verifyToken': Sequelize.STRING
  });

  dynamodb.scan({
    'TableName': 'dt_registered',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      User.sync().then(function () {
        User.bulkCreate(data.Items);
        sequelize.close();
      });
    }
  });

});


gulp.task('db-restore-deleted', function () {
  dynamodb.scan({
    'TableName': 'dt_drips_deleted',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (drip) {
        dynamodb.put({
          'TableName': 'dt_drips',
          'Item': drip
        }, function (error) {
          if (error) console.log(error);
          console.log(drip);
        });
      });
    }
  });
});


gulp.task('db-drips-add-media', function () {
  dynamodb.scan({
    'TableName': 'dt_drips',
    'ProjectionExpression': 'ownerId, createdAt, media',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (drip) {
        if (typeof drip.media === 'undefined') {
          drip.media = [];
          dynamodb.update({
            'TableName': 'dt_drips',
            'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
            'AttributeUpdates': {'media': {'Action': 'PUT',
                                            'Value': drip.media}}
          }, function (error) {
            if (error) console.log(error);
            console.log(drip);
          });
        }
      });
    }
  });
});

gulp.task('db-drips-rename-upvotes', function () {
  dynamodb.scan({
    'TableName': 'dt_drips',
    'ProjectionExpression': 'ownerId, createdAt, counts',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (drip) {
          drip.counts.upVotes = drip.counts.upvotes;
          drip.counts.downVotes = drip.counts.downvotes;
          delete drip.counts.downvotes;
          delete drip.counts.upvotes;
          dynamodb.update({
            'TableName': 'dt_drips',
            'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
            'AttributeUpdates': {'counts': {'Action': 'PUT',
                                            'Value': drip.counts}}
          }, function (error) {
            if (error) console.log(error);
            console.log(drip);
          });
      });
    }
  });
});


gulp.task('db-users-rename-upvotes', function () {
  dynamodb.scan({
    'TableName': 'dt_users',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (drip) {
          console.log(drip);
          if (typeof drip.counts === 'undefined' ) {
              drip.counts = {'createdDrips': 0,
                        'purchasedDrips': 0,
                        'upVotes': 0,
                        'downVotes': 0};
          } else {
            drip.counts.upVotes = 0;
            drip.counts.downVotes = 0;
            delete drip.counts.downvotes;
            delete drip.counts.upvotes;
          }
          dynamodb.update({
            'TableName': 'dt_users',
            'Key': {'cognitoId': drip.cognitoId},
            'AttributeUpdates': {'counts': {'Action': 'PUT',
                                            'Value': drip.counts}}
          }, function (error) {
            if (error) console.log(error);
            console.log(drip);
          });
      });
    }
  });
});


gulp.task('db-users-set-texts', function () {
  dynamodb.scan({
    'TableName': 'dt_users',
    'Limit': 1000
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (user) {
        user.bio = user.bio ? user.bio : '';
        user.name = user.name ? user.name : '';
        user.website = user.website ? user.website : '';
          dynamodb.update({
            'TableName': 'dt_users',
            'Key': {'cognitoId': user.cognitoId},
            'AttributeUpdates': {
              'bio': {'Action': 'PUT', 'Value': user.bio},
              'name': {'Action': 'PUT', 'Value': user.name},
              'website': {'Action': 'PUT', 'Value': user.website}
            }
          }, function (error) {
            if (error) console.log(error);
            console.log(user);
          });
      });
    }
  });
});


gulp.task('db-drips-add-id', function () {
  dynamodb.scan({
    'TableName': 'dt_drips',
    'ProjectionExpression': 'ownerId, createdAt, counts',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (drip) {
        dynamodb.update({
          'TableName': 'dt_drips',
          'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
          'AttributeUpdates': {'id': {'Action': 'PUT',
                                      'Value': drip.createdAt + drip.ownerId}}
        }, function (error) {
          if (error) console.log(error);
          console.log(drip);
        });
      });
    }
  });
});

gulp.task('db-drips-add-reports', function () {
  dynamodb.scan({
    'TableName': 'dt_drips',
    'ProjectionExpression': 'ownerId, createdAt, counts',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (drip) {
        drip.counts.reports = 0;
        dynamodb.update({
          'TableName': 'dt_drips',
          'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
          'AttributeUpdates': {'counts': {'Action': 'PUT', 'Value': drip.counts}
                              }
        }, function (error) {
          if (error) console.log(error);
          console.log(drip);
        });
      });
    }
  });
});

gulp.task('db-drips-add-publishedAt', function () {
  dynamodb.scan({
    'TableName': 'dt_drips',
    'ProjectionExpression': 'ownerId, createdAt, counts',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (drip) {
        dynamodb.update({
          'TableName': 'dt_drips',
          'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
          'AttributeUpdates': {'publishedAt': {'Action': 'PUT', 'Value': null},
                               'active': {'Action': 'DELETE'}
                              }
        }, function (error) {
          if (error) console.log(error);
          console.log(drip);
        });
      });
    }
  });
});


gulp.task('db-add-usernames', function () {
  dynamodb.scan({
    'TableName': 'dt_users',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (user) {
          dynamodb.put({
            'TableName': 'dt_usernames',
            'Item': {'username': user.username, 'cognitoId': user.cognitoId}
          }, function (error, user) {
            if (error) console.log(error);
            console.log(user);
          });
      });
    }
  });
});


gulp.task('db-sorted-owned', function () {
  var cognitoId = 'us-east-1:399b8a0e-33da-4566-b3bb-b7ea2aa9439e';
  cognitoId = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';
  dynamodb.query({
    'TableName': 'dt_drips',
    'ScanIndexForward': false,
    'FilterExpression': 'attribute_not_exists(deletedAt)',
    'KeyConditionExpression': 'ownerId = :ownerId',
    'ExpressionAttributeValues': {':ownerId': cognitoId},
    'ProjectionExpression': 'ownerId, createdAt, counts',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    console.log(data);
  });
});


gulp.task('db-sorted-feed', function () {
  var feedSet = 'default';
  var limit = 10;
  var params = {
    'TableName': 'dt_feeds',
    'KeyConditionExpression': '#set = :set',
    'ExpressionAttributeValues': {':set': feedSet},
    'ExpressionAttributeNames': {'#set': 'set'},
    'ScanIndexForward': false,
    'Limit': limit
  };
  dynamodb.query(params, function (err, data) {
    if (err) return console.log(err);
    console.log(data);
  });
});


gulp.task('db-sorted-captured', function () {
  var cognitoId = 'us-east-1:399b8a0e-33da-4566-b3bb-b7ea2aa9439e';
  // cognitoId = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';
  dynamodb.query({
    'TableName': 'dt_captured',
    'ScanIndexForward': false,
    'KeyConditionExpression': 'ownerId = :ownerId',
    'ExpressionAttributeValues': {':ownerId': cognitoId},
    'ProjectionExpression': 'ownerId, dripId',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    console.log(data);
  });
});


gulp.task('db-drips-move-to-feed', function () {
  dynamodb.scan({
    'TableName': 'dt_drips',
    'ProjectionExpression': 'id',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (drip) {
        dynamodb.put({
          'TableName': 'dt_feeds',
          'Item': {'set': 'default', 'dripId': drip.id}
        }, function (error) {
          if (error) console.log(error);
          console.log(drip);
        });
      });
    }
  });
});


gulp.task('db-users-default-photos', function () {
  dynamodb.scan({
    'TableName': 'dt_users',
    'ProjectionExpression': 'cognitoId, profilePhoto, coverPhoto',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (user) {
        if (user.profilePhoto === null) {
          user.profilePhoto =
            'https://s3.amazonaws.com/dt-profilepics/default.jpg';
        }
        if (user.coverPhoto === null) {
          user.coverPhoto =
            'https://s3.amazonaws.com/dt-coverpics/default.jpg';
        }
        dynamodb.update({
          'TableName': 'dt_users',
          'Key': {'cognitoId': user.cognitoId},
          'AttributeUpdates': {
                'profilePhoto': {'Action': 'PUT', 'Value': user.profilePhoto},
                'coverPhoto': {'Action': 'PUT', 'Value': user.coverPhoto}}
        }, function (error) {
          if (error) console.log(error);
          console.log(user);
        });
      });
    }
  });
});


gulp.task('db-channel-icons', function () {
  dynamodb.scan({
    'TableName': 'dt_channels',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (channel) {
        channel.icon = 'https://s3.amazonaws.com/dt-media/channels/' +
          channel.name + '.png';
        dynamodb.update({
          'TableName': 'dt_channels',
          'Key': {'name': channel.name},
          'AttributeUpdates': {
                'icon': {'Action': 'PUT', 'Value': channel.icon}
          }
        }, function (error) {
          if (error) console.log(error);
          console.log(channel);
        });
      });
    }
  });
});


gulp.task('db-load-iaps', function () {
  var iaps = require('../iaps.json');
  iaps.items.forEach(function (iap) {
    dynamodb.put({
      'TableName': 'dt_iap',
      'Item': {'iapId': iap.identifier,
               'dripcoins': iap.dripcoinValue}}, function (error) {
      if (error) console.log(error);
      console.log(iap);
    });
  });
});


function getUsersPublishedDrips (fn) {
  var cloudsearch = new AWS.CloudSearchDomain({
    'endpoint': config.CS_DRIPS
  });
  var params = {
    // 'query': "ownerid:'" + ownerId + "'",
    'query': "matchall",
    'queryParser': 'structured',
    'facet': "{'ownerid': {}}",
    'filterQuery': "(and deleted:0 published:1)",
    'sort': 'createdat desc'
  };
  cloudsearch.search(params, function (err, data) {
    if (err) return console.log(err);
    return fn(null, _.indexBy(data.facets.ownerid.buckets, 'value'));
  });
}


gulp.task('db-users-publishedDrips', function () {
  dynamodb.scan({
    'TableName': 'dt_users',
    'ProjectionExpression': 'cognitoId, username, counts',
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      getUsersPublishedDrips(function (pErr, usermap) {
        if (pErr) return console.log(pErr);
        console.log(usermap);
        data.Items.forEach(function (user) {
          if (usermap[user.cognitoId]) {
            user.counts.publishedDrips = usermap[user.cognitoId].count;
          } else {
            user.counts.publishedDrips = 0;
          }
          var params = {
            'TableName': 'dt_users',
            'Key': {'cognitoId': user.cognitoId},
            'AttributeUpdates': {
                  'counts': {'Action': 'PUT', 'Value': user.counts},
                  'countw': {'Action': 'DELETE'}}
          };
          dynamodb.update(params, function (error) {
            if (error) console.log(error);
          });
        });
      }, function (aErr) {
        if (aErr) return console.log(aErr);
        console.log('done');
      });
    }
  });
});


function encode (dripId) {
  var Hashids = require('hashids');
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


gulp.task('db-drips-add-shortId', function () {
  dynamodb.scan({
    'TableName': 'dt_drips',
    'ProjectionExpression': 'ownerId, createdAt',
    'Limit': 1000
  }, function (err, data) {
    if (err) return console.log(err);
    else {
      data.Items.forEach(function (drip) {
        drip.shortId = encode(drip.createdAt + drip.ownerId);
        dynamodb.update({
          'TableName': 'dt_drips',
          'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
          'AttributeUpdates': {'shortId': {'Action': 'PUT',
                                           'Value': drip.shortId}}
        }, function (error) {
          if (error) console.log(error);
          console.log(drip);
        });
      });
    }
  });
});
