console.log('Loading stream vote event');
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
            var newVote, oldVote, upvoteCount, voteCount;

            if (record.dynamodb.OldImage)
                oldVote = record.dynamodb.OldImage.voteValue.N;
            if (record.dynamodb.NewImage)
                newVote = record.dynamodb.NewImage.voteValue.N;

            console.log(oldVote);

            if(oldVote<newVote)
                upvoteCount=1;
            else
                upvoteCount=0;

            if(newVote==0){
                voteCount=0;
                upvoteCount=0;
            }else{
                voteCount=1;
            }

            if (drips[record.dynamodb.Keys.dripGuid.S]) {
                drips[record.dynamodb.Keys.dripGuid.S].upvoteCount += upvoteCount;
                drips[record.dynamodb.Keys.dripGuid.S].voteCount += voteCount;
            } else {
                drips[record.dynamodb.Keys.dripGuid.S] = {};
                drips[record.dynamodb.Keys.dripGuid.S].voteCount = voteCount;
                drips[record.dynamodb.Keys.dripGuid.S].upvoteCount = upvoteCount;
            }
        }
    });
    console.log(JSON.stringify(event));

    for(var drip in drips){

        var item = drip.split("_");

        var params = {
            TableName: 'dripthat_drip',
            Key: { // The primary key of the item (a map of attribute name to AttributeValue)
                IdentityId: {
                    S: item[0]
                },
                createdAt: {
                    N: item[1]
                }
            },
            ExpressionAttributeValues: {
                ":upvoteCount": {
                    "N": String(drips[drip].upvoteCount)
                },
                ":voteCount": {
                    "N": String(drips[drip].voteCount)
                },
            },
            UpdateExpression: "ADD voteCount :voteCount, upvoteCount :upvoteCount",
            ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
            ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
            ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
        };
        dynamodb.updateItem(params, function(err, data) {
            if (err)
                console.log(err);
            delete drips[drip];
            if (drips === []) {
                context.done();
            }
        });
    };
};
