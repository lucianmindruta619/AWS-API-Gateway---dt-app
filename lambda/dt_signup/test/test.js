/* global config, console, describe, env, it, require */
config = require('../../../scripts/config.json');
env = require('../../../scripts/env.json');
var lambda = require('../dt_signup');
var assert = require('assert');

var context = {
  'fail': function (err) { return this.done(err);},
  'succeed': function (data) { return this.done(null, data);}
};

var event = {
  "email": "spiderman@dripthat.com",
  "username": "peter",
  "password": "parker"
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
