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
curl -X PUT http://localhost:1337/subscribe/pub_queue/sub_queue
```

This creates a 'queue' called sub_queue. Every message that gets published to pub_queue also gets published in 'sub_queue'.

This means that there's a channel called 'sub_queue' can can be subcribed to via the Redis Pub/Sub commands. This publication tells you there's new things to be read from from the 'sub_queue' list.

