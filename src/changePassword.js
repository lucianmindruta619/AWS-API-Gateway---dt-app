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

    if (res.password.length < 4 || res.oldPassword && res.oldPassword.length < 4) {
        context.fail("password cannot be less than 4 characters");
    }

    if (!res.oldPassword) {
        res.oldPassword = "*"
    }

    res.nowT = (new Date().getTime().toString());

    var params = {
        TableName: 'dripthat_user',
        Key: { // The primary key of the item (a map of attribute name to AttributeValue)
            IdentityId: {
                S: res.IdentityId
            }
        },
        ExpressionAttributeNames: {
            '#password': "password"
        },
        ExpressionAttributeValues: {
            ":oldPassword": {
                "S": res.oldPassword
            },
            ":password": {
                "S": res.password
            },
            ":cat": {
                "N": res.nowT
            }
        },
        ConditionExpression: 'attribute_exists(IdentityId) AND ((:oldPassword = #password) OR attribute_not_exists(#password))',
        UpdateExpression: "SET #password = :password, lastModified = :cat",
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
