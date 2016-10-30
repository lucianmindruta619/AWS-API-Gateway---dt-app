var AWS = require('aws-sdk');

var ses = new AWS.SES();
var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();

exports.handler = function(event, context) {
    // in here we're just listing the user Dataset Records
    //  Then we're calling the updateRecords function

    var res = {};

    res.DatasetName = 'user';
    res.DatasetName = event.IdentityId;
    res.IdentityPoolId = 'us-east-1:d7d9f99e-83e4-452b-bece-d98cd2c2b812';
    res.SyncSessionToken = event.SyncSessionToken;
    res.ClientContext = event.ClientContext;
    res.DeviceId = event.DeviceId;
    res.dripId = event.dripId;

    res.RecordPatches = [{
        Key: 'drip',
        Op: 'delete',
        SyncCount: 0,
        Value: res.dripId
    }, ];

    var params = {
        TableName: 'dripthat_drip',
        Key: { // The primary key of the item (a map of attribute name to AttributeValue)
            IdentityId: {
                S: res.IdentityId
            },
            createdAt: {
                N: res.dripId
            }
        },
        ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
        ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
    };
    /*  This is an exmaple RecordPatches Array:
        RecordPatches: [{
            Key: event.key,
            Op: event.Op,
            SyncCount: event.SyncCount,
            DeviceLastModifiedDate: event.DeviceLastModifiedDate,
            Value: event.Value
        }, ]
    */
    cognitosync.updateRecords(params, function(err, data) {
        if (err) {
            context.fail(err);
        } else {
            context.succeed(data);
        }
    });
};
