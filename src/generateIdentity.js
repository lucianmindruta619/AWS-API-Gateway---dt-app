var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();

var cognitoModule = require('cognitoModule.js');
var user = require('userUtils.js');
exports.handler = function(event, context) {
    var res = event;

    var req = {};

    res.nowT = (new Date().getTime().toString());

    cognitoModule.identity(cognitoidentity, function(err, id_data) {
        if (err) {
            context.fail(err);
        } else {
            res.IdentityId = id_data.IdentityId;
            cognitoModule.token(cognitoidentity, res, function(err, token_data) {
                if (err) {
                    context.fail(err);
                } else {
                    res.idToken = token_data.Token;
                    res.expDate = String(Number(res.nowT)+90000);
                    dynamodb.updateItem(user.updateToken(res), function(err, data) {
                        if (err) {
                            context.fail(err);
                        } else {
                            data.Attributes.IdentityId = {};
                            data.Attributes.IdentityId.S = res.IdentityId;
                            context.succeed(data); // successful response
                        }
                    });
                }
            });
        }
    });
};
