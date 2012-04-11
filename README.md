# About 

QDis is a simple durable pub/sub queue built using Redis and Node.JS. 

[![build status](https://secure.travis-ci.org/gflarity/qdis.png)](http://travis-ci.org/gflarity/qdis)

# Publishing

To publish you use the Redis API, first you start a transaction using MULTI then LPUSH to a list, then PUBLISH on a channel to announce something new is available. Run EXEC to execute the transaction.

Example

```
MULTI
LPUSH pub one
PUBLISH pub 1
EXEC
```
 
# Subscribing

First you need to setup your subscription queue using the restful API:

```
curl -X POST http://localhost:6380/subscribe/pub_queue/sub_queue
```

This creates a 'queue' called sub_queue. Every message that gets published to pub_queue also gets published in 'sub_queue'.

This means that there's a channel called 'sub_queue' can can be subcribed to via the Redis Pub/Sub commands. This publication tells you there's new things to be read from from the 'sub_queue' list.

To unsubscribe:

```
curl -X POST http://localhost:6380/unsubscribe/pub_queue/sub_queue
```

To list subscriptions:

```
curl -X GET http://localhost:6380/subscriptions
```


