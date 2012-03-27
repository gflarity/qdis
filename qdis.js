var redis = require("redis");

var sub_client = redis.createClient();
var pub_client = redis.createClient();

sub_client.on("error", function (err) {
    console.log("sub error " + err);
});

pub_client.on("error", function (err) {
    console.log("pub error " + err);
});

var print_error = function (err, replies) { if ( err ) { console.log( "multi error!: " + err ) } };

var pub_queues = [];
var map =  {};

var handle_message = function (channel, message) {
    
    //the channel name is also used as the name of the list 
    pub_client.rpop( channel, function( err, reply ) {
            
        var sub_queues = map[channel];
        
        //do everything in a multi
        var multi = pub_client.multi();            
        for (var i = 0; i < sub_queues.length; i++ ) {
                                
            var sub_queue =  sub_queues[i];
            multi.lpush( sub_queue, reply );
            multi.publish( sub_queue, "1" );
        }

        // drains multi queue and runs atomically
        multi.exec( print_error );
        
    });
};
        

var publication_queues = [ 'pub' ];
var subscription_queues = [ 'sub1', 'sub2', 'sub3' ];


//get our maps, and set out our automatic publications

pub_client.hgetall( '_qdis_mappings', function( err, redis_map ) {
    
    for ( var pub_queue in redis_map ) {

        pub_queues.push( pub_queue );
        sub_queues = JSON.parse(redis_map[pub_queue]);
        map[pub_queue] = sub_queues; 
    }
    
    sub_client.on("message", handle_message );

    //setup our subscriptions now that we're ready to handle them
    for (var i = 0; i< pub_queues.length; i++ ) {    
      sub_client.subscribe( pub_queues[i] );    
    }

});

//???
sub_client.on("subscribe", function (channel, count) {

});
