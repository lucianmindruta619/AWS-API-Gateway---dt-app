/* global config, console, describe, env, it, require */
config = require('../../../scripts/config.json');
env = require('../../../scripts/env.json');
var lambda = require('../dt_test');
var assert = require('assert');

var context = {
  'fail': function (err) { return this.done(err);},
  'succeed': function (data) { return this.done(null, data);}
};

var event = {
  "identity": {
      "id": "us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09",
      "type": "authenticated"
  },
  "config": "{SNS_MEDIA_TOPIC=arn:aws:sns:us-east-1:493526813836:dt-media, IDENTITY_POOL_NAME=dt_identities, CUSTOMERIO_USER=45d825e9cf6220e825c9, MYSQL_HOST=dripthat.clo8bmqwoh9m.us-east-1.rds.amazonaws.com, DEVELOPER_PROVIDER_NAME=login.dripthat.dripthat, MYSQL_PORT=3306, DDB_VOTES_TABLE=dt_votes, DDB_REPORTS_TABLE=dt_reports, DDB_PURCHASES_TABLE=dt_purchases, IDENTITY_POOL_ID=us-east-1:4af9f534-7cd3-4b16-bf9e-255bfe2f0e2a, DDB_FEEDS_TABLE=dt_feeds, DDB_CHANNELS_TABLE=dt_channels, SNS_REPORT_TOPIC=arn:aws:sns:us-east-1:493526813836:dt-reports, DDB_REGISTERED_TABLE=dt_registered, MYSQL_PASS=esM8WwasB2kmxh, MYSQL_NAME=dripthat, CUSTOMERIO_PASSWORD=38912f2b8e433eb2caa1, MYSQL_USER=dtuser, DDB_USERNAMES_TABLE=dt_usernames, DDB_SALES_TABLE=dt_sales, DDB_CAPTURED_TABLE=dt_captured, DDB_USERS_TABLE=dt_users, REGION=us-east-1, API_ID=n188zfgouj, AWS_ACCOUNT_ID=493526813836, EXTERNAL_NAME=DripthatAuthentication, DDB_DRIPS_TABLE=dt_drips, EMAIL_SOURCE=info@dripthat.com}",
  "collection": "all"
};

describe('Lambda', function () {
  it('should succeed', function (done) {
    this.timeout(10000);
    context.done = function (err, data) {
      if (err) throw err;
      console.log(data);
      done();
    };
    lambda.handler(event, context);
  });
});
