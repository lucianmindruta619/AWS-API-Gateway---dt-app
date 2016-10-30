/* global config, exports, require */
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();

function getUser (cognitoId, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
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

function getDrip (dripId, fn) {
  var createdAt = Number(dripId.slice(0, 13));
  var ownerId = dripId.slice(13);
  dynamodb.get({'TableName': config.DDB_DRIPS_TABLE,
                'Key': {'ownerId': ownerId, 'createdAt': createdAt}},
               function (err, drip) {
      if (err) return fn('Internal Server Error: ' + err);
      return drip.Item ? fn(null, drip.Item) : fn('Not Found: Drip ' + dripId);
  });
}

function updateDrip (drip, fn) {
  dynamodb.update({
    'TableName': config.DDB_DRIPS_TABLE,
    'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
    'AttributeUpdates': {
      'counts': {'Action': 'PUT', 'Value': drip.counts}
    }
  }, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    return fn(null, data);
  });
}

function validate (data, fn) {
  if (data.like < -1 || data.like > 1) {
    return fn('Bad Request: Like can be [-1, 0, 1]');
  }
  if (!data.ownerId) return fn('Bad Request: Owner cannot be empty');
  if (!data.dripId) return fn('Bad Request: Drip cannot be empty');

  data.dripId = decodeURIComponent(data.dripId);

  data.createdAt = new Date().getTime();

  getUser(data.ownerId, function (err, user) {
    if (err) return fn(err);
    if (!user) return fn('Not Found: User ' + data.ownerId);
    getDrip(data.dripId, function (error, drip) {
      if (error) return fn(error);
      if (!drip) return fn('Not Found: Drip ' + data.drip);
      /* if (drip.ownerId === data.ownerId) {
          return fn('Forbidden: User cannot vote on own drip');
      } */
      return fn(null, user, drip, data);
    });
  });
}

function getPreviousVote (ownerId, dripId, fn) {
  dynamodb.get({'TableName': config.DDB_VOTES_TABLE,
                'Key': {'ownerId': ownerId, 'dripId': dripId}},
               function (err, vote) {
      if (err) return fn('Internal Server Error: ' + err);
      return fn(null, vote.Item);
  });
}

function updateVote (vote, fn) {
  if (vote.like === 0) {
    dynamodb.delete({'TableName': config.DDB_VOTES_TABLE,
                     'Key': {'ownerId': vote.ownerId, 'dripId': vote.dripId}},
                    function (err, data) {
      if (err) return fn('Internal Server Error: ' + err);
      return fn(null, data);
    });
  } else {
    dynamodb.put({
      'TableName': config.DDB_VOTES_TABLE,
      'Item': vote
    }, function (err, data) {
      if (err) {
          return fn('Internal Server Error: ' + err);
      }
      return fn(null, data);
    });
  }
}

function reportIfNecessary (drip, fn) {
  if (drip.counts.reports > 10) {
    return fn();
  }
  var sns = new AWS.SNS();
  var params = {
      'Message': drip.id,
      'TopicArn': config.SNS_REPORT_TOPIC
  };
  sns.publish(params, function (err) {
    if (err) fn('Internal Server Error: SNS:' + err);
    fn(null);
  });
}

function invalidatePrev (prev, drip, user) {
  if (prev.like === 1) {
    user.counts.upVotes -= 1;
    drip.counts.upVotes -= 1;
  } else {
    user.counts.downVotes -= 1;
    drip.counts.downVotes -= 1;
  }
  if (prev.report === true) {
    drip.counts.reports -= 1;
  }
}

function addVote (vote, drip, user) {
  if (vote.like !== 0) {
    if (vote.like === 1) {
      user.counts.upVotes += 1;
      drip.counts.upVotes += 1;
    } else {
      user.counts.downVotes += 1;
      drip.counts.downVotes += 1;
    }
  }
  if (vote.report) {
    drip.counts.reports += 1;
  }
}

exports.handler = function (event, context) {

  var like, report;
  if (!event.like) {
      like = 0;
  } else {
      like = parseInt(event.like);
  }
  if (typeof event.report === 'undefined') {
      report = false;
  } else {
      report = event.report;
  }
  if (report === true) {
      like = -1;
  }
  var data = {'ownerId': event.identity.id,
              'dripId': decodeURIComponent(event.dripId),
              'like': like, 'report': report};
  data.report = event.report === true ? true : false;
  validate(data, function (error, user, drip, vote) {
    if (error) return context.fail(error);
    getPreviousVote(vote.ownerId, vote.dripId, function (prev_error, prev) {
      if (prev_error) return context.fail(prev_error);
      updateVote(vote, function (err) {
        if (err) return context.fail(err);
        if (prev) {
          invalidatePrev(prev, drip, user);
        }
        addVote(vote, drip, user);

        updateUser(user, function (user_error) {
          if (user_error) return context.fail(user_error);
          updateDrip(drip, function (drip_error) {
            if (drip_error) return context.fail(drip_error);

            reportIfNecessary(drip, function (rErr) {
              if (rErr) return context.fail(rErr);
              context.succeed(vote);
            });
          });
        });
      });
    });
  });
};
