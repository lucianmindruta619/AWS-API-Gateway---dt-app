/* global config, exports, require */

var AWS = require('aws-sdk');
var qr = require('qr-js');
var gm = require('gm')
            .subClass({'imageMagick': true});

var bucketname = 'dt-media';
var filekey = 'driptags/DriptagTemplate.png';
var geometry = '+70+125';

function fetchTemplate (fn) {
  var s3 = new AWS.S3();
  s3.getObject({
    'Bucket': bucketname,
    'Key': filekey
  }, function (err, data) {
    if (err) fn(err);
    return fn(null, data.Body);
  });
}

function createQRfile (contents, fn) {
  var filename = '/tmp/qr.png';
  var params = {
    'value': contents,
    'foreground': '#fff',
    'background': '#3EB1B7',
    'size': '9'
  };
  qr.saveSync(params, filename);
  return fn(null, filename);
}

exports.handler = function (event, context) {
  var dripId = decodeURIComponent(event.dripId);
  var hostname = decodeURIComponent(event.hostname);
  if (!hostname) {
    hostname = 'http://dripthat.com';
  }
  var uri = hostname + '/drips/' + dripId;
  fetchTemplate(function (tErr, templateBuffer) {
    if (tErr) context.fail(tErr);
    createQRfile(uri, function (qrErr, qrFile) {
      if (qrErr) return context.fail(qrErr);
      gm(templateBuffer).composite(qrFile)
      // .gravity('center')
      .geometry(geometry)
      /* .write('composite.png', function (err) {
        if (err) context.fail(err);
        context.succeed('OK!');
      });*/
      .toBuffer('png', function (err, buffer) {
        if (err) return context.fail(err);
        context.succeed({'image': buffer.toString('base64')});
      });
    });
  });
};
