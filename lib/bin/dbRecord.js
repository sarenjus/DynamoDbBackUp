'use strict';

const AWS = require('aws-sdk');
const crypto = require('crypto');

class DbRecord {
    constructor(config) {
        this.S3Bucket = config.S3Bucket;
        this.S3Region = config.S3Region;
        this.S3Prefix = config.S3Prefix;
        this.AwsConfig = config.awsConfig;
    }

    backup(changes) {
        let promises = [];
        changes.forEach(change => {
            promises.push(this.backupChange(change));
        });
        return Promise.all(promises);
    }

    backupChange(change) {
        return new Promise((resolve, reject) => {
            let s3 = new AWS.S3(this.AwsConfig);

            let id = crypto.createHash('md5')
                .update(change.keys)
                .digest('hex');
            let key = [this.S3Prefix, id].join('/');

            let params = {
                Bucket: this.S3Bucket,
                Key: key,
                StorageClass: 'STANDARD_IA'
            };

            let req = change.event === 'REMOVE' ? 'deleteObject' : 'putObject';
            if (req === 'putObject') params.Body = change.data;
            if (req === 'putObject') params.ServerSideEncryption = 'AES256';

            s3[req](params, (err) => {
                if (err) {
                    console.log(
                        '[error] %s | %s s3://%s/%s | %s',
                        change.keys, req, params.Bucket, params.Key, err.message
                    );
                    return reject(err);
                }
                return resolve();
            });
        });
    }
}

module.exports = DbRecord;
