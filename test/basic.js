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
 client = net.connect( 6379, on_connect );   
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

test( 'teardown', function( done ) {
    qdis.kill();
    done();
} );
