/* global config, console, describe, env, it, require */
config = require('../../../scripts/config.json');
env = require('../../../scripts/env.json');
var lambda = require('../dt_qr');
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
  "dripId": "1451427425472us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09",
  "hostname": "http://dripthat.com"
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
