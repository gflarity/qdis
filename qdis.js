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
        
        //if the queue ( redis list ) is empty, it might be a race with the
        //undelivered message checker
        if ( err ) {            
            //TODO log this so we know it happened, but otherwise just bail
            return;
        }
        
        var sub_queues = map[global_channel];
        var pub_queue = global_channel; //they are named the same
        
        // multi's only ensure ordering and all the commands will get executed 
        // (or none) not rollback on error of one of the
        // commands: http://redis.io/topics/transactions
        var multi = pub_client.multi();
        //pop from the pub_queue, but only if transaction succeeds
        multi.rpop( pub_queue );
        for (var i = 0; i < sub_queues.length; i++ ) {
                                
            var sub_queue =  sub_queues[i];
            multi.lpush( sub_queue, reply );
            
            // regardless of the result above, this publish happens
            // TODO we should wait for the multi result before publishing?           
            multi.publish( sub_queue, "1" );
        }

        // drains multi queue and runs atomically
        multi.exec( print_error );
};


var channel_message_queue = [];
var on_message = function (channel, message, fake ) {
    
    
    //set the global channel for on_lindex_response closure
    //the channel name is also used as the name of the list 
    //get the last item    
    global_channel = channel;    
    pub_client.lindex( channel, -1, on_lindex_response );                

};


//under certain conditions there may be undelivered messages in pub queues...
//for instance, say qdis goes down, but Redis stays up, then we restart redis
//we need to periodically check for this and deliver them, we do this
//by faking out on_message to avoid race conditions
var check_for_undelivered_messages = function() {

    for( var i = 0; i< pub_queues.length; i++ ) {                     
        pub_client.llen( pub_queues[i], on_llen_complete_generator( pub_queues[i] ) );        
    }   
};

var on_llen_complete_generator = function( pub_queue ) {
  
  var on_llen_complete = function( err, length ) {

        if ( length === 0 ) {            
            return;
        }
    
        //for now we just trigger N fake on_message calls
        //TODO eventually the message should probably length of the list instead
        for( var i = 0; i < length; i++ ) {            
            on_message( pub_queue, 1, true );   
        }
      
  };  
  return on_llen_complete;
};


//everytime we reconnect we need to re-subscribe
var undelivered_check_internval_id;

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
    
        check_for_undelivered_messages();
        
        //once every second to check again, just incase
        undelivered_check_internval_id = setTimeout( check_for_undelivered_messages, 1000 );        
    
    });

};


var on_connection_end = function() {
    
    clearInterval(undelivered_check_internval_id);
    undelivered_check_internval_id = undefined;
};

//these only need to be set once!
sub_client.on( 'message', on_message );
sub_client.on( 'connect', on_sub_client_connect );
sub_client.on( 'end', on_connection_end );

server.listen(6380, function() {
  console.log('Rest API listening at %s',  server.url);
});
