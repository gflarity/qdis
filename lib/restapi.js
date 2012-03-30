var restify = require('restify');



var RestAPI = module.exports = function( map, pub_client, sub_client ) {
    
    this.map = map;
    this.pub_client = pub_client;
    this.sub_client = sub_client;

    
    this.server = restify.createServer( { name: 'QDis' } );
    
    this.server.post('/unsubscribe/:pub_queue/:sub_queue', this.unsubscribe.bind( this ) );
    this.server.post('/subscribe/:pub_queue/:sub_queue', this.subscribe.bind( this ) );
    this.server.get('/subscriptions/:pub_queue', this.subscriptions.bind( this ) );    
    this.server.get('/subscriptions', this.subscriptions.bind( this ) );    
    
};


RestAPI.prototype.subscribe = function( req, res, next ) {

    var pub_queue = req.params.pub_queue;
    var sub_queue = req.params.sub_queue;
    var sub_queues = this.map[pub_queue];
    
    if ( ! sub_queues ) {
            
        //no subscriptions for this queue until, set things up        
        this.map[pub_queue] = sub_queues = [ sub_queue ];  
        this.sub_client.subscribe( pub_queue );    
    }
    else {
        
        //if it's not already in here, add it
        if ( sub_queues.indexOf( sub_queue ) === -1 ) {            
            sub_queues.push( sub_queue );                
        }            
    }
    
    //persist the subscription update  
    //TODO only do this when a change is made
    this.pub_client.hset( '_qdis_mappings', pub_queue, JSON.stringify( sub_queues ), function() { res.end() } );
    
};


RestAPI.prototype.unsubscribe = function( req, res, next ) {
    
    var that = this;
    
    var pub_queue = req.params.pub_queue;
    var sub_queue = req.params.sub_queue;
    var sub_queues = this.map[pub_queue];
    
    var index = sub_queues.indexOf( sub_queue );    
    if ( index != -1 ) {
        
        sub_queues.splice(index,1);              
    }
        
    if (sub_queues.length > 0 ) {
        //persist the subscription update  
        //TODO only do this when a change is made 
        this.pub_client.hset( '_qdis_mappings', pub_queue, JSON.stringify( sub_queues ), function( err ) { 
            
            that.sub_client.subscribe( pub_queue );    
        
            res.end( err ) 
        });
        
    }
    else {
        
        this.pub_client.hdel( '_qdis_mappings', pub_queue,  function( err ) { res.end( err ) } );
    }
};

RestAPI.prototype.subscriptions = function( req, res, next ) {

    var pub_queue = req.params.pub_queue;

    if ( pub_queue ) {
        
        res.end( JSON.stringify( this.map[pub_queue] ) );
    }
    else {
        res.end( JSON.stringify( this.map ) );        
    }
};


RestAPI.prototype.listen = function( port, host ) {

    var that = this;
    
    var on_listening = function() {
        console.log('%s REST API listening at %s',  that.server.name, that.server.url );
    };
  
    if ( host ) { 
        this.server.listen( port, host, on_listening );
    }
    else {
        
        this.server.listen( port, on_listening );    
    }
};