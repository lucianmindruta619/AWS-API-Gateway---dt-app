/* global console, require */

var gulp = require('gulp');
var AWS = require('aws-sdk');
var _ = require('lodash');
var config = require('../scripts/config.json');
AWS.config.update({'region': 'us-east-1'});
var dynamodb = new AWS.DynamoDB.DocumentClient();
require('dotenv').load();


function indexDrips (drips, fn) {
  var documents = _.map(drips, function (drip) {
    var pop_score = (drip.counts.upvotes ? drip.counts.upvotes : 0) - (drip.counts.downvotes ? drip.counts.downvotes : 0);

    var fields = {'createdat': drip.createdAt,
                  'purchases': drip.counts.purchased,
                  'upvotes': drip.counts.upvotes,
                  'downvotes': drip.counts.downvotes,
                  'ownerid': drip.ownerId,
                  'popularity': 1.0,
                  'popularityscore': pop_score,
                  'description': drip.description,
                  'title': drip.title,
                  'tags': drip.tags};
    fields.deleted = drip.deletedAt ? 1 : 0;
    fields.published = drip.publishedAt ? 1 : 0;
    return {'type': 'add', 'id': drip.id,
            'fields': fields};
  });

  var cloudsearch = new AWS.CloudSearchDomain({
    'endpoint': config.CS_DRIPS_UP
  });
  var params = {'documents': JSON.stringify(documents),
                'contentType': 'application/json'};
  cloudsearch.uploadDocuments(params, function (err, data) {
    if (err) return fn(err);
    return fn(null, data);
  });
}

function removeDrips (drips, fn) {
  var documents = _.map(drips, function (drip) {
    return {'type': 'delete', 'id': drip.id};
  });

  var cloudsearch = new AWS.CloudSearchDomain({
    'endpoint': config.CS_DRIPS_UP
  });
  var params = {'documents': JSON.stringify(documents),
                'contentType': 'application/json'};
  cloudsearch.uploadDocuments(params, function (err, data) {
    if (err) return fn(err);
    return fn(null, data);
  });
}

function indexUsers (users, fn) {
  var documents = _.map(users, function (user) {
    var fields = {'createdat': user.createdAt,
                  'updatedat': user.updateAt,
                  'username': user.username,
                  'email': user.email,
                  'createddrips': user.counts.createdDrips,
                  'purchaseddrips': user.counts.purchasedDrips,
                  'publisheddrips': user.counts.publishedDrips,
                  'downvotes': user.counts.downVotes,
                  'upvotes': user.counts.upVotes};
    if (user.bio) fields.bio = user.bio;
    if (user.name) fields.name = user.name;
    if (user.website) fields.website = user.website;
    if (user.dob) fields.dob = user.dob;
    if (user.sex) fields.sex = user.sex;
    return {'type': 'add', 'id': user.cognitoId,
            'fields': fields};
  });

  var cloudsearch = new AWS.CloudSearchDomain({
    'endpoint': config.CS_USERS_UP
  });
  var params = {'documents': JSON.stringify(documents),
                'contentType': 'application/json'};
  cloudsearch.uploadDocuments(params, function (err, data) {
    if (err) return fn(err);
    return fn(null, data);
  });
}


gulp.task('search-count-drips', function () {
  var ownerId = 'us-east-1:399b8a0e-33da-4566-b3bb-b7ea2aa9439e';

  var cloudsearch = new AWS.CloudSearchDomain({
    'endpoint': config.CS_DRIPS
  });
  var params = {
    'query': "ownerid:'" + ownerId + "'",
    'queryParser': 'structured',
    'facet': "{'ownerid': {}}",
    'filterQuery': "(and deleted:0 published:1)",
    'sort': 'createdat desc'
  };
  console.log(params);
  cloudsearch.search(params, function (err, data) {
    if (err) return console.log(err);
    return console.log(data.facets.ownerid.buckets[0].count);
  });
});


gulp.task('search-index-drips', function () {
  dynamodb.scan({
    'TableName': config.DDB_DRIPS_TABLE,
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    indexDrips(data.Items, function (iErr, sData) {
      if (iErr) return console.log(iErr);
      return console.log(sData);
    });
  });
});

gulp.task('remove-index-drips', function () {
  dynamodb.scan({
    'TableName': config.DDB_DRIPS_TABLE,
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    removeDrips(data.Items, function (iErr, sData) {
      if (iErr) return console.log(iErr);
      return console.log(sData);
    });
  });
});

gulp.task('search-drips-tags', function () {
  var tag = 'Funny';
  var cloudsearch = new AWS.CloudSearchDomain({
    'endpoint': config.CS_DRIPS
  });
  var params = {
    'query': "tags:'" + tag + "'",
    'queryParser': 'structured',
    'filterQuery': "(and deleted:0 published:1)",
    'sort': 'createdat desc'
  };
  console.log(params);
  cloudsearch.search(params, function (err, data) {
    if (err) return console.log(err);
    if (!data.hits.found) return console.log('No drips found');
    return console.log(_.pluck(data.hits.hit, 'id'));
  });
});

gulp.task('search-index-users', function () {
  dynamodb.scan({
    'TableName': config.DDB_USERS_TABLE,
    'Limit': 100
  }, function (err, data) {
    if (err) return console.log(err);
    indexUsers(data.Items, function (iErr, sData) {
      if (iErr) return console.log(iErr);
      return console.log(sData);
    });
  });
});


gulp.task('search-users-username', function () {
  var username = 'superman';
  var cloudsearch = new AWS.CloudSearchDomain({
    'endpoint': config.CS_USERS
  });
  var params = {
    'query': "username:'" + username + "'",
    'queryParser': 'structured',
    'sort': 'username desc'
  };
  console.log(params);
  cloudsearch.search(params, function (err, data) {
    if (err) return console.log(err);
    if (!data.hits.found) return console.log('No users found');
    return console.log(_.pluck(data.hits.hit, 'id'));
  });
});



