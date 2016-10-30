.Sconsole.log('Loading stream vote event');
var AWS = require('aws-sdk');

var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();
var s3 = new AWS.S3();

var tableName = "dripthat";

function makeString(str) {
    return {
        'S': str.toString()
    };
}

function makeNumber(n) {
    return {
        'N': n.toString()
    };
}

function makeStringSet(s) {
    return {
        'SS': s
    };
}

function putString(str) {
    return {
        'Action': 'PUT',
        'Value': {
            'S': str.toString()
        }
    };
}

function putStringSet(set) {
    return {
        'Action': 'PUT',
        'Value': {
            'SS': set
        }
    };
}

function putNumber(str) {
    return {
        'Action': 'PUT',
        'Value': {
            'N': str.toString()
        }
    };
}

exports.handler = function(event, context) {

    var drips = {};
    event.Records.forEach(function(record) {
        var drip = {};
        if (record.eventName == 'INSERT') {
            // this is a new vote
            if (drips[record.dynamodb.NewImage.userId.S]) {
                drips[record.dynamodb.NewImage.userId.S].followerCount += 1;
            } else {
                drips[record.dynamodb.NewImage.userId.S] = {};
                drips[record.dynamodb.NewImage.userId.S].followerCount = 1;
            }
            if (drips[record.dynamodb.Keys.IdentityId.S]) {
                drips[record.dynamodb.Keys.IdentityId.S].followingCount += 1;
            } else {
                drips[record.dynamodb.Keys.IdentityId.S] = {};
                drips[record.dynamodb.Keys.IdentityId.S].followingCount = 1;
            }
        }
        if (record.eventName == 'REMOVE') {
            // this is a new vote
            if (drips[record.dynamodb.NewImage.userId.S]) {
                drips[record.dynamodb.NewImage.userId.S].followerCount += -1;
            } else {
                drips[record.dynamodb.NewImage.userId.S] = {};
                drips[record.dynamodb.NewImage.userId.S].followerCount = -1;
            }
            if (drips[record.dynamodb.Keys.IdentityId.S]) {
                drips[record.dynamodb.Keys.IdentityId.S].followingCount += -1;
            } else {
                drips[record.dynamodb.Keys.IdentityId.S] = {};
                drips[record.dynamodb.Keys.IdentityId.S].followingCount = -1;
            }
        }
    });
    console.log(JSON.stringify(event));

    for(var drip in drips){
        if (drips[drip].followingCount) {
            var params = {
                TableName: 'dripthat_user',
                Key: { // The primary key of the item (a map of attribute name to AttributeValue)
                    IdentityId: {
                        S: drip
                    },
                },
                ExpressionAttributeValues: {
                    ":followingCount": {
                        "N": String(drips[drip].followingCount)
                    },
                },
                UpdateExpression: "followingCount ADD :followingCount",
                ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
                ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
                ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
            };
            dynamodb.updateItem(params, function(err, data) {
                if (err)
                    console.log(err);
                delete drips[drip].followingCount;
                if (drips[drip] === []) {
                    context.done();
                }
            });
        }
        if (drips[drip].followerCount) {
            var params = {
                TableName: 'dripthat_user',
                Key: { // The primary key of the item (a map of attribute name to AttributeValue)
                    IdentityId: {
                        S: drip
                    },
                },
                ExpressionAttributeValues: {
                    ":followerCount": {
                        "N": String(drips[drip].followerCount)
                    },
                },
                UpdateExpression: "followerCount ADD :followerCount",
                ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
                ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
                ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
            };
            dynamodb.updateItem(params, function(err, data) {
                if (err)
                    console.log(err);
                delete drips[drip].followerCount;

                if (drips[drip] === []) {
                    context.done();
                }
            });
        }
    };
};
