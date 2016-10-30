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
    res.SyncCount = event.SyncCount;
    res.SyncSessionToken = event.SyncSessionToken;
    res.ClientContext = event.ClientContext;
    res.DeviceId = event.DeviceId;

    res.RecordPatches = [{
        Key: 'phoneNumberCode',
        Op: 'replace',
        SyncCount: res.SyncCount,
        Value: res.phoneNumberCode
    }, ];

    var params = {
        DatasetName: res.DatasetName,
        IdentityId: res.IdentityId,
        IdentityPoolId: res.IdentityPoolId,
        SyncSessionToken: res.SyncSessionToken,
        ClientContext: res.ClientContext,
        DeviceId: res.DeviceId,
        RecordPatches: res.RecordPatches
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
