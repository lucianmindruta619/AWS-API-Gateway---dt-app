var AWS = require('aws-sdk');

exports.handler = function(event, context) {
    var cloudsearchdomain = new AWS.CloudSearchDomain({
        endpoint: config.CS_USERS_UP
    });

    var documents = event.Records.map(function(record) {

        var data = {
            id: record.dynamodb.Keys.cognitoId.S
        };

        if (record.eventName === 'REMOVE') {
            data.type = 'delete'
        } else {
            var image = record.dynamodb.NewImage;
            data.type = 'add';
            data.fields = {};   

            data.fields = {
                bio: image.bio.S,
                createdat: image.createdAt.N,
                createddrips: image.counts.M.createdDrips.N,
                dob: image.dob.S,
                downvotes: image.counts.M.downVotes.N,
                email: image.email.S,
                name: image.name.S,
                purchaseddrips: image.counts.M.purchasedDrips.N,
                sex: image.sex.S,
                updatedat: image.updatedAt.N,
                upvotes: image.counts.M.upVotes.N,
                username: image.username.S,
                website: image.website.S                
            };
        }
        return data;
    });

    var params = {
        contentType: 'application/json',
        documents: JSON.stringify(documents)
    };

    console.log('uploading documents to cloudsearch domain', params);
    cloudsearchdomain.uploadDocuments(params, function(err, data) {
        if (err) {
            console.log('Error uploading documents to cloudsearch', err, err.stack);
            context.fail(err);
        } else {
            context.succeed("Successfully processed " + event.Records.length + " records.");
        }
    });
};