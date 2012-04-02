var redis = require("redis");
var subscription_client = redis.createClient();
var regular_client = redis.createClient();

subscription_client.on( 'message', function( channel, message ) {

    //the channel name is the same name as the list
    regular_client.rpop( channel, redis.print );

} );
subscription_client.subscribe( 'sub1' );

