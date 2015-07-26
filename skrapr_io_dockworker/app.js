﻿var Consumer = require('sqs-consumer');
var AWS = require("aws-sdk");
var s3 = new AWS.S3();
var url = require("url");
var moment = require("moment");
var got = require("got");

var app = Consumer.create({
    queueUrl: process.env.dockyardQueueUrl,
    handleMessage: function (message, done) {
        console.log("=======================================");
        console.log(moment().format("MM/DD hh:mm:ss") + ": Received Message " + message.MessageId);
        
        var headers = [];
        var messageBody = JSON.parse(message.Body);
        var urlToDownload = messageBody.Message;
        var urlToDownloadUrl = url.parse(urlToDownload);
        var urlToDownloadKey = urlToDownloadUrl.host + urlToDownloadUrl.pathname;

        //TODO: Test if the file already exists.
        var checkParams = { Bucket: process.env.dockyardBucket, Key: urlToDownloadKey };
        s3.headObject(checkParams, function (err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else console.log(data);           // successful response
        });

        var gotParams = {
            method: "GET",
            headers: {
                "pragma": "no-cache",
                "cache-control": "no-cache",
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.107 Safari/537.36",
                "Accept-Encoding": "gzip, deflate, sdch",
                "Accept-Language": "en-US,en; q = 0.8"
            }
        };

        got(urlToDownloadUrl, gotParams)
            .then(function (res) {
                console.log(moment().format("MM/DD hh:mm:ss") + ": Downloaded " + urlToDownload + " (" + res.headers['content-type'] + ") " + res.headers['content-length']);

                if (res.connection && res.connection._host)
                    urlToDownloadKey = res.client._host + urlToDownloadUrl.pathname;        

                var uploadParams = {
                    Bucket: process.env.dockyardBucket,
                    Key: urlToDownloadKey,
                    Body: res.body,
                    ContentType: res.headers['content-type'],
                    Metadata: {
                        originMessageId: message.MessageId,
                        originUrl: urlToDownload,
                        retrievedOn: Date.now().toString()
                    }
                };

                var uploadOptions = { partSize: 10 * 1024 * 1024, queueSize: 1 };
                s3.upload(uploadParams, uploadOptions, function (err, data) {
                    if (err) {
                        done(err);
                    }
                    else {
                        console.log(moment().format("MM/DD hh:mm:ss") + ": Stored " + urlToDownload + " as " + data.Location);
                        done();
                    }
                });
            })
            .catch(function (err) {
                console.log(moment().format("MM/DD hh:mm:ss") + ": Error retrieving " + urlToDownload);
                console.log(err);
                done(err);
            });

        //new Download({
        //    agent: tunnel.httpOverHttp({
        //        proxy: {
        //            host: 'localhost',
        //            port: 8888
        //        }
        //    }),
        //    method: "GET",
        //    headers: {
        //        "host": myHost,
        //        "pragma": "no-cache",
        //        "cache-control": "no-cache",
        //        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        //        "user-agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.107 Safari/537.36",
        //        "Accept-Encoding": "gzip, deflate, sdch",
        //        "Accept-Language": "en-US,en; q = 0.8"
        //    }
        //})
        //    .get(urlToDownload)
        //    .use(function (response, currentUrl) {
        //    headers.push(response.headers);
        //    myHost = url.parse(response.headers.location).host;
        //})
        //    .run(function (err, files) {
            
        //    if (err) {
        //        console.log(moment().format("MM/DD hh:mm:ss") + ": Error retrieving " + urlToDownload);
        //        console.log(err);
        //        done(err);
        //    }
        //    else {
        //        console.log(moment().format("MM/DD hh:mm:ss") + ": Downloaded " + files.length + " files");
                
        //        files.forEach(function (file) {
        //            console.log("\t" + file.url + "\t" + headers['content-type'] + " " + file._contents.length);
        //            var uploadParams = {
        //                Bucket: "skrapr-io-dockyard",
        //                Key: urlToDownloadKey,
        //                Body: file._contents,
        //                ContentType: headers['content-type'],
        //                Metadata: {
        //                    originMessageId: message.MessageId,
        //                    originUrl: file.url,
        //                    retrievedOn: Date.now().toString()
        //                }
        //            };
                    
        //            var uploadOptions = { partSize: 10 * 1024 * 1024, queueSize: 1 };
        //            s3.upload(uploadParams, uploadOptions, function (err, data) {
        //                if (err) {
        //                    done(err);
        //                }
        //                else {
        //                    console.log(moment().format("MM/DD hh:mm:ss") + ": Stored " + file.url + " as " + data.Location);
        //                    done();
        //                }
        //            });
        //        });
        //    }
        //});
    }
});

app.on('error', function (err) {
    console.log(err.message);
});

console.log("Listening...");
app.start();