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

cd "$(dirname "$0")"
cd ../
make clean

arr=( $(jq 'keys[]' scripts/config.json) )
KEYS=`printf "%s\n" ${arr[@]} | tr -d '"'`
SED=sed
for KEY in $KEYS; do
    eval $KEY=$(jq -r ".$KEY" scripts/config.json)
    VAL=${!KEY}
    SED="$SED -e \"s/<$KEY>/$VAL/g\""
done

if [ -d "./iam/edit" ]; then
  rm -f ./iam/edit/*
else
  mkdir ./iam/edit
fi

cd iam


# Create IAM Roles for Cognito
for f in $(ls -1 trust*); do
  echo "Editing trust $f..."
  CMD="$SED $f > edit/$f"
  eval $CMD
done
for f in $(ls -1 cognito*); do
  role="${f%.*}"
  echo "Updating role $role..."
  CMD="$SED $f > edit/$f"
  eval $CMD
  if [[ $f == *unauth* ]]; then
    trust="trust_policy_cognito_unauth.json"
    unauthRole="$role"
  else
    trust="trust_policy_cognito_auth.json"
    authRole="$role"
  fi
  aws iam update-assume-role-policy --role-name $role --policy-document file://edit/$trust
  aws iam put-role-policy --role-name $role --policy-name $role --policy-document file://edit/$f
done
