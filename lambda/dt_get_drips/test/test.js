/* global config, console, describe, env, it, require */
config = require('../../../scripts/config.json');
env = require('../../../scripts/env.json');
var lambda = require('../dt_get_drips');
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
  "collection": "owned",
  "by": "us-east-1:399b8a0e-33da-4566-b3bb-b7ea2aa9439e"
};

describe('Lambda', function () {
  it('should be successful', function (done) {
    this.timeout(10000);
    context.done = function (err, data) {
      if (err) throw err;
      console.log(data);
      done();
    };
    lambda.handler(event, context);
  });
});
