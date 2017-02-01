'use strict';

const AWS = require('aws-sdk');

class DbInstanceData {
    constructor(config, dbRecord) {
        this.DbTable = config.DbTable;
        this.DbRegion = config.DbRegion;
        this.dbRecord = dbRecord;
        this.AwsConfig = config.awsConfig;
    }

    retrieve() {
        return this.getTableKeys()
            .then(keys => {
                return this.getRecords(keys)
                    .catch(err => {
                        throw err;
                    });
            })
            .catch(err => {
                throw err;
            });
    }

    getTableKeys() {
        return new Promise((resolve, reject) => {
            let dynamoDb = new AWS.DynamoDB(this.AwsConfig);
            dynamoDb.describeTable({ TableName: this.DbTable }, (err, data) => {
                if (err) {
                    return reject(err);
                }
                console.log(this.DbTable + ': Got key schema ' + JSON.stringify(data.Table.KeySchema));
                return resolve(data.Table.KeySchema);
            });
        });
    }

    getRecords(keys) {
        return new Promise((resolve, reject) => {

            let dynamodb = new AWS.DynamoDB(this.AwsConfig);
            let params = {
                TableName: this.DbTable,
                ExclusiveStartKey: null,
                Limit: 100,
                Select: 'ALL_ATTRIBUTES'
            };

            var numberOfRecords = 0;

            function recursiveCall(params) {
                return new Promise((rs, rj) => {

                    dynamodb.scan(params, (err, data) => {
                        if (err) {
                            return rj(err);
                        }

                        let records = [];
                        data.Items.forEach((item) => {
                            let id = {};
                            keys.forEach(key => {
                                id[key.AttributeName] = item[key.AttributeName];
                            });

                            let record = {
                                keys: JSON.stringify(id),
                                data: JSON.stringify(item),
                                event: 'INSERT'
                            };
                            records.push(record);
                        });

                        let promises = [];
                        records.forEach(record => {
                            promises.push(this.dbRecord.backup([record]));
                        });
                        Promise.all(promises)
                            .then(() => {
                                numberOfRecords += data.Items.length;
                                console.log(this.DbTable + ': Retrieved ' + data.Items.length + ' records; total at ' + numberOfRecords + ' records.');
                                if (data.LastEvaluatedKey) {
                                    params.ExclusiveStartKey = data.LastEvaluatedKey;
                                    return recursiveCall.call(this, params).then(() => {
                                        rs();
                                    });
                                } else {
                                    return rs();
                                }
                            })
                            .catch(err => {
                                rj(err);
                            });
                    });
                });
            }

            recursiveCall.call(this, params).then(() => { resolve() });
        });
    }

}

module.exports = DbInstanceData;
