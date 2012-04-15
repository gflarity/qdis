# About 

QDis is a simple durable pub/sub queue built using Redis and Node.JS. 

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

This means that there's a [Redis Pub/Sub channel](http://redis.io/topics/pubsub) called 'sub_queue' which can be subscribed to. This publication is a notice which tells you there's something new to be read from from the 'sub_queue' [Redis list](http://redis.io/commands#list). You're expected to LPOP from the 'sub_queue' list whenever you're ready to consume another message. 

Every once and a while you'll probably want to check there's nothing to be consumed in 'sub_queue' regardless of publication notices. This should never happen if you're subscription socket is working.

To unsubscribe:

```
curl -X POST http://localhost:6380/unsubscribe/pub_queue/sub_queue
```

To list subscriptions:

```
curl -X GET http://localhost:6380/subscriptions
```


