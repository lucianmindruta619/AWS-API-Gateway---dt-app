var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();
var user = require('userUtils.js');

exports.handler = function(event, context) {
    var res = event;
    res.nowT = (new Date().getTime().toString());
    dynamodb.updateItem(user.changeUsername(res), function(err, data) {
        if (err) {
            context.fail(err);
        } else {
            context.succeed(data); // successful response
        }
    });
};