var redis = require("redis"),
    client = redis.createClient();
    
setInterval( function( ) {
    
    var multi = client.multi();
    client.lpush( 'pub', "test " + new Date().getTime() );
    client.publish( 'pub', "1" );
    multi.exec();
    
}, 0 );
