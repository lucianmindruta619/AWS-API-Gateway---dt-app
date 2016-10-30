/* global config, exports, require */

// dependencies
var AWS = require('aws-sdk');

exports.handler = function(event, context) {
    var cloudsearchdomain = new AWS.CloudSearchDomain({
        endpoint: config.CS_DRIPS_UP
    });

    var documents = event.Records.map(function(record) {
        var data = {
            id: record.dynamodb.Keys.createdAt.N + record.dynamodb.Keys.ownerId.S
        };

        if (record.eventName === 'REMOVE') {
            data.type = 'delete'
        } else {
            var image = record.dynamodb.NewImage;
            data.type = 'add';
            data.fields = {};
            var pop_score = (image.counts.M.upVotes.N ? image.counts.M.upVotes.N : 0) - (image.counts.M.downVotes.N ? image.counts.M.downVotes.N : 0);
            
            data.fields = {
                createdat: image.createdAt.N,
                purchases: image.counts.M.purchased.N,
                upvotes: image.counts.M.upVotes.N,
                downvotes: image.counts.M.downVotes.N,
                popularityscore: pop_score,
                popularity: 1.0,
                description: image.description.S,
                title: image.title.S,
                ownerid: image.ownerId.S,
                tags: JSON.stringify(image.tags.L)};
            data.fields.deleted = image.deletedAt && image.deletedAt.N ? 1 : 0;
            data.fields.published = image.publishedAt && image.publishedAt.N ? 1 : 0;
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