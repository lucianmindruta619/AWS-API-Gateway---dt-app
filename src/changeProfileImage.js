console.log('Loading create user event');
var AWS = require('aws-sdk');

var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();

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

function putString(str) {
    return {
        'Action': 'PUT',
        'Value': {
            'S': str.toString()
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
    var res = event;

    var req = {};

    var nowT = (new Date().getTime().toString());

    var params = {
        TableName: 'dripthat_user',
        Key: { // The primary key of the item (a map of attribute name to AttributeValue)
            IdentityId: {
                S: res.IdentityId
            }
        },
        ExpressionAttributeNames: {
            '#profile': "profileImage",
            '#tok': "idToken"
        },
        ExpressionAttributeValues: {
            ":ImageKey": {
                "S": res.imageKey
            },
            ":tok": {
                "S": res.idToken
            },
            ":cat": {
                "N": nowT
            }
        },
        ConditionExpression: 'attribute_exists(IdentityId) AND (#tok = :tok) AND (:cat < expDate)',
        UpdateExpression: "SET #profile = :ImageKey, lastModified = :cat",
        ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
        ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
        ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
    };
    dynamodb.updateItem(params, function(err, data) {
        if (err) {
            context.fail(err);
        } else {
            context.succeed(data); // successful response
        }
    });

};
