#!/bin/bash
set -e

# Check if the AWS CLI is in the PATH
found=$(which aws)
if [ -z "$found" ]; then
  echo "Please install the AWS CLI under your PATH: http://aws.amazon.com/cli/"
  exit 1
fi

# Check if jq is in the PATH
found=$(which jq)
if [ -z "$found" ]; then
  echo "Please install jq under your PATH: http://stedolan.github.io/jq/"
  exit 1
fi

# Read other configuration from credentials.tmp
AWS_ACCESS_KEY_ID=$(jq -r '.AccessKeyId' credentials.tmp)
AWS_SECRET_ACCESS_KEY=$(jq -r '.SecretAccessKey' credentials.tmp)
AWS_SESSION_TOKEN=$(jq -r '.SessionToken' credentials.tmp)


echo export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
echo export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
echo export AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN
