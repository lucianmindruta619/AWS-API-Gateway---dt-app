/* global config, console, describe, env, it, require */
config = require('../../../scripts/config.json');
env = require('../../../scripts/env.json');
var lambda = require('../dt_create_drip');
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
  "title": "a title",
  "description": "a description",
  "price": "0",
  "collection": "all"
};

describe('Lambda', function () {
  it('should return successfully', function (done) {
    this.timeout(10000);
    context.done = function (err, data) {
      if (err) throw err;
      console.log(data);
      done();
    };
    lambda.handler(event, context);
  });
});
