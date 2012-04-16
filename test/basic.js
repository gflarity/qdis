var net = require('net');
var child_process = require('child_process');
var request = require('request');
var redis = require('redis');
var async = require('async');
var assert = require('assert');

function ok(expr, msg) {
  if (!expr) throw new Error(msg);
}


suite('Basic Tests -');
var complete = false;
var qdis;
var redis_client;

test('Redis is listening', function( done ){
 var client;
 var on_connect = function( socket ) { done(); client.end();  };
    client = net.connect( 6379,  on_connect );   
});

test('Flush Redis DB', function( done ) {
    
    redis_client = redis.createClient();
    redis_client.flushdb( function() { done() } );
    
} );


test('start QDis', function( done ) {    
    qdis = child_process.spawn( 'node', ['qdis.js'] );

    qdis.on( 'exit', function() { if ( ! complete ) { throw new Error('qdis died young') } } );

    setTimeout(function() {
        var client;
        var on_connect = function( socket ) { client.end(); done();  };
        client = net.connect( 6380, on_connect );   
    }, 500 );
    
} );


test('create subscriptions', function( done ) {    
    
    var requests = [];
    var request_callback = 
    
    //subscriptions request 1
    requests.push( function( cb ) { 
       var request_callback = function( err, res, body ) {
            if ( err ) { throw err }        
                        
            var json = JSON.parse( body );                                    
            cb( null,  json );
        };
        request.post('http://localhost:6380/subscribe/pub/sub1', request_callback );
    });
    
    //subscriptions request 2
    requests.push( function( cb ) { 
        var request_callback = function( err, res, body ) {
            if ( err ) { throw err }        
            var json = JSON.parse( body );     
            cb( null, json );
        };
        request.post('http://localhost:6380/subscribe/pub/sub2', request_callback );
    });
    
    //subscriptions request 3
    requests.push( function(  cb ) { 
         var request_callback = function( err, res, body ) {
            if ( err ) { throw  err  }        
            var json = JSON.parse( body );     
            cb( null,  json );
        };
        request.post('http://localhost:6380/subscribe/pub/sub3', request_callback );
    });
    
    //dupe should be handled silently
    requests.push( function(  cb ) { 
         var request_callback = function( err, res, body ) {
            if ( err ) { throw  err  }        
            var json = JSON.parse( body );     
            cb( null,  json );
        };
        request.post('http://localhost:6380/subscribe/pub/sub3', request_callback );
    });
    
    async.series( requests, function( err, result ) {
    
        result.forEach( function( value ) { if ( value !== true ) throw Error( 'a subscription failed' ) } );

        
         request( 'http://localhost:6380/subscriptions', function( err, res, body ) {
            if ( err ) { throw err }
        
            var json = JSON.parse( body );
            
            assert( json.pub )
            assert( json.pub.length === 3 )
            assert( json.pub.indexOf( 'sub1' ) !== -1 )
            assert( json.pub.indexOf( 'sub2' ) !== -1 )
            assert( json.pub.indexOf( 'sub3' ) !== -1 )
            done();
            
        });
    });    
     
   
});

test( 'send 3 messages with no listeners', function( done ) {  
    
    var multi = redis_client.multi();
    
    multi.lpush( "pub", "first" );
    multi.publish( "pub", 1 );
    multi.lpush( "pub", "second" );
    multi.publish( "pub", 1 );
    multi.lpush( "pub", "third" );
    multi.publish( "pub", 1 );
    multi.exec( function( err, replies ) { 
        if ( err ) { throw err }
                
        setTimeout( function() {
            var multi2 =  redis_client.multi();        
            multi2.llen( 'sub1').llen( 'sub2' ).llen( 'sub3');
            multi2.exec( function( err, replies ) {
            
                assert( replies.length === 3 );
                assert( replies[0] === 3 );
                assert( replies[1] === 3 );
                assert( replies[2] === 3 );
                done();
            } );        
        }, 100 );
    } );
} );



test( 'unsubscribe 1, send 3 more', function( done ) {  
    var series = [];
    
    series.push( function( cb ) { 
        var request_callback = function( err, res, body ) {
            if ( err ) { throw err }        
                var json = JSON.parse( body );     
                return cb( null, json );
            };
        request.post('http://localhost:6380/unsubscribe/pub/sub1', request_callback );
    } );
    
    series.push( function( json, cb ) {
    
       
        
        var multi = redis_client.multi();        
        multi.lpush( "pub", "fourth" );
        multi.publish( "pub", 1 );
        multi.lpush( "pub", "fifth" );
        multi.publish( "pub", 1 );
        multi.lpush( "pub", "sixth" );
        multi.publish( "pub", 1 );
        multi.exec( function( err, replies ) { 
            if ( err ) { throw err }

            setTimeout( function() {
                var multi2 =  redis_client.multi();        
                multi2.llen( 'sub1').llen( 'sub2' ).llen( 'sub3');
                multi2.exec( function( err, replies ) {
                    
                    assert( replies.length === 3 );
                    assert( replies[0] === 3 );
                    assert( replies[1] === 6 );
                    assert( replies[2] === 6 );
                    
                    return cb( null );
                } );        
            }, 100 );
        } );
    } );
    
    series.push( function( cb ) {
        done();
    } );
    async.waterfall( series );
    
    
} );

    
test( 'teardown', function( done ) {
    complete = true;
    qdis.kill();
    done();
} );
