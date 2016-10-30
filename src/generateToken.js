var AWS = require('aws-sdk');

var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();

var cognitoModule = require('cognitoModule.js');
var user = require('userUtils.js');


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
    res.nowT = (new Date().getTime().toString());
    if (!res.IdentityId) {
        context.succeed("Missing IdentityId");
    }
    cognitoModule.token(cognitoidentity, res, function(err, token_data) {
        if (err) {
            context.fail(err);
        } else {
            res.idToken = token_data.Token;
            res.expDate = String(Number(res.nowT)+900000);

            dynamodb.updateItem(user.updateToken(res), function(err, data) {
                if (err) {
                    context.fail(err);
                } else {
                    context.succeed(data); // successful response
                }
            });
        }
    });
};
