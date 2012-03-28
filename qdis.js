var redis = require("redis");
var restify = require('restify');

var sub_client = redis.createClient();
var pub_client = redis.createClient();
var server = restify.createServer();

sub_client.on("error", function (err) {
    console.log("sub error " + err);
});

pub_client.on("error", function (err) {
    console.log("pub error " + err);
});


var subscribe = function( req, res, next ) {

    var pub_queue = req.params.pub_queue;
    var sub_queue = req.params.sub_queue;

    var sub_queues = map[pub_queue];
    
    if ( ! sub_queues ) {
            
        //no subscriptions for this queue until, set things up
        
        map[pub_queue] = sub_queues = [ sub_queue ];  
        sub_client.subscribe( pub_queue );
        
    }
    else {
        
        //if it's not already in here, add it
        if ( sub_queues.indexOf( sub_queue ) === -1 ) {            
            sub_queues.push( sub_queue );                
        }            
    }
    
    //persist the subscription update  
    //TODO only do this when a change is made
    pub_client.hset( '_qdis_mappings', pub_queue, JSON.stringify( sub_queues ), function() { res.end() } );
    
};
server.put('/subscribe/:sub_queue/:pub_queue', subscribe );

var print_error = function (err, replies) { if ( err ) { console.log( "multi error!: " + err ) } };

//globals so that closures only need to be created once
var pub_queues = [];
var map =  {};
var global_channel;





//this get's the pub queue's R
var on_lindex_response = function( err, reply ) {
            
        var sub_queues = map[global_channel];
        var pub_queue = global_channel; //they are named the same
        
        //do everything in a multi (transaction)
        var multi = pub_client.multi();
        //pop from the pub_queue, but only if transaction succeeds
        multi.rpop( pub_queue );
        for (var i = 0; i < sub_queues.length; i++ ) {
                                
            var sub_queue =  sub_queues[i];
            multi.lpush( sub_queue, reply );
            multi.publish( sub_queue, "1" );
        }

        // drains multi queue and runs atomically
        multi.exec( print_error );
};


var handle_message = function (channel, message) {
    
    //set the global channel for on_lindex_response closure
    global_channel = channel;
    
    //the channel name is also used as the name of the list 
    //get the last item
    pub_client.lindex( channel, -1, on_lindex_response );
        
};


//everytime we reconnect we need to re-subscribe
var on_sub_client_connect = function() {    
//get our maps, and set out our automatic publications

pub_client.hgetall( '_qdis_mappings', function( err, redis_map ) {
    
    for ( var pub_queue in redis_map ) {

        pub_queues.push( pub_queue );
        sub_queues = JSON.parse(redis_map[pub_queue]);
        map[pub_queue] = sub_queues; 
    }
        
    //setup our subscriptions now that we're ready to handle them
    for (var i = 0; i< pub_queues.length; i++ ) {    
      sub_client.subscribe( pub_queues[i] );    
    }


});

};

//these only need to be set once!
sub_client.on("message", handle_message );
sub_client.on( 'connect', on_sub_client_connect );

server.listen(6380, function() {
  console.log('Rest API listening at %s',  server.url);
});
