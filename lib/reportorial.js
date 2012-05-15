var url = require('url')
, http = require('http')
, https = require('https');

var Reportorial = Reportorial || {};

Reportorial.user_id = null;
Reportorial.get_user_id = function() {
	return Reportorial.user_id;
}

Reportorial.user_token = null;
Reportorial.get_user_token = function() {
	return Reportorial.user_token;
}

Reportorial.set_user_id = function(val) {
	Reportorial.user_id = val;
}

Reportorial.set_user_token = function(val) {
	Reportorial.user_token = val;
}

Reportorial.get_topic_id_from_topic_arn = function( topic_arn ) {
	var splitted = topic_arn.split(':');
	return splitted[ splitted.length - 1 ];
}

Reportorial.get_user_creds = function() {

	var user_id = this.get_user_id();
	var user_token = this.get_user_token();

	if( !!user_id && !!user_token ) {
		return user_id + ":" + user_token + "@";
	} else { 
		return false;
	}

}

Reportorial.verify_incoming_message_is_subscription_confirmation_request = function( data, headers ) {
	console.log( 'checking', data.Type );
	if( "undefined" !== typeof data && "SubscriptionConfirmation" === data.Type ) {
		return true;		
	} else if( "undefined" !== typeof headers && "SubscriptionConfirmation" === headers[ 'x-amz-sns-message-type' ] ) {
		return true;	
	} else {
		return false;
	}
}

Reportorial.verify_incoming_message_is_new_item_notification = function( data ) {
	console.log( 'checking', data.Type );
	if( "undefined" !== typeof data && "Notification" === data.Type ) {
		return true;		
	} else {
		return false;
	}
}

Reportorial.process_new_item_notification = function( data ) {
	console.log('NOTIFICATION', data.Subject, data.Message );

	var subject_json = JSON.parse( data.Subject );
	var message_json = JSON.parse( data.Message );
	console.log( 'mapped', Buleys.stream.map.news( message_json ) );

	var item = JSON.parse( message_json );
	var topic = subject_json.to;	
	var cont;
	console.log('BEFORE entities and object', item );
	if( item.object.content || item.object.summary ) {

		cont = ( ( item.object.content ) ? item.object.content : '' ) + ( ( item.object.summary ) ? ' ' + item.object.summary : '' );

		item.entities = classifier.classify( cont );
		console.log(':1075 entities and object', cont, item );
		if( null === item.entities ) {
			item.entities = [ { 'topic': 'none', 'score': 0 } ];
		} else {
			console.log('SORRY NO ENTITIES', cont);
		}
	} 

	//zzz
	var tagged;
	if( 'undefined' !== typeof message && 'undefined' !== typeof message.object && 'undefined' !== typeof message.object.content ) {
		console.log("SHOULD TAG HERE",message.object.content);
		//tagged = new pos.Tagger().tag( message.object.content );
	}
	var tmp = item;
	var message = {};

	message.activity = tmp;
	message.type = 'news';
	message.entities = item.entities;

	for( var i in item.entities ) {
	var channel =  item.entities[ i ].topic;
	for( key in topics_subs[ channel ] ) {
		var user = topics_subs[ channel ][ key ];		
		user.socket.emit( 'data', message ); 
	}
	}
	var score = null;
	for( var i in item.entities ) {
		if ( item.topic === item.entities[ i ].topic ) {
			score = item.entities[ i ].score;
		}
	}
	if( 'all' === topic ) {
		console.log( "SHOULD BE PUBLISHED", topic, item, 'news', score, null );
		Public.prototype.trigger( 'create', { topic: topic, item: item, type: news, score: score, user: null } );; 
		//publish( topic, item, 'news', score, null );
	
	//	for( var j in item.entities ) {
	//		publish( item.entities[ j ], item, 'news', score, null );
	//	}
	} else {	
		Public.prototype.trigger( 'create', { topic: topic, item: item, type: news, score: score, user: null } );; 
		//publish( topic, item, 'news', score, null );
	}

};

Reportorial.process_subscription_confirmation_request = function( data, headers ) {
	console.log( 'Reportorial.process_subscription_confirmation_request', data, headers );
	var topic_arn = data.TopicArn || headers[ 'x-amz-sns-topic-arn' ];
	var confirmation_id = data.Token || headers[ 'x-amz-sns-message-id' ];
	var endpoint = this.get_api_endpoint();
	this.confirm_subscription( topic_arn, confirmation_id, endpoint );
};

Reportorial.subscribe_to_topic = function( topic_arn, endpoint ) {
	
	var post_data = { 'endpoint': endpoint, 'protocol': ( ( -1 !== endpoint.indexOf( 'https' ) ) ? 'https' : 'http' ) };
	var user_id = this.get_user_id();
	var user_token = this.get_user_token();
	var topic_id = null;
	if( -1 !== topic_arn.indexOf( ':' ) ) {
		topic_id = this.get_topic_id_from_topic_arn( topic_arn );
	} else {
		topic_id = topic_arn;
	}
	var request_url = this.build_api_call( 'topic', topic_id, 'subscribe', user_id, user_token );

	var on_success = function( result ) {
		console.log("subscribed to topic successfully", result );
	}

	var on_error = function( result ) {
		console.log("could not subscribe to topic", result );
	}
	console.log( 'Reportorial.subscribe_to_topic > this.send_api_request()', { 'user_id': user_id, 'user_token': user_token }, request_url, post_data, true );
	this.send_api_request( { 'user_id': user_id, 'user_token': user_token }, request_url, post_data, true );

};


Reportorial.unsubscribe_from_topic = function( topic_arn, endpoint ) {

	var post_data = { 'endpoint': endpoint, 'protocol': 'http' };
	var user_id = this.get_user_id();
	var user_token = this.get_user_token();
	var topic_id = this.get_topic_id_from_topic_arn( topic_arn );
	var request_url = this.build_api_call( 'topic', topic_id, 'unsubscribe' );

	var on_success = function( result ) {
		console.log("unsubscribed from topic successfully", result );
	}

	var on_error = function( result ) {
		console.log("could not unsubscribe from topic", result );
	}

	this.send_api_request( { 'user_id': user_id, 'user_token': user_token }, request_url, post_data, true );

};

Reportorial.build_api_call = function( type, slug, method ) {
	var api_endpoint = Reportorial.get_api_endpoint();
	/*
	var auth_string = Reportorial.get_user_creds();
	if( false !== auth_string ) {
		api_endpoint = api_endpoint.replace('http://', '');
		api_endpoint = "http://" + auth_string + api_endpoint;
	}
	*/
	api_endpoint = api_endpoint.replace( new RegExp(/\/$/g), "" );
	if( "undefined" !== typeof slug ) {
		return api_endpoint + "/" + type + "/" + method + "/" + slug;
	} else {
		return api_endpoint + "/" + type + "/" + method;
	}
}

Reportorial.get_api_endpoint = function() {
	return "http://api.reportorial.com";
}

Reportorial.confirm_subscription = function( topic_arn, confirmation_id, endpoint ) {

	/* Variables */

	var user_id = this.get_user_id();
	var user_token = this.get_user_token();
	var topic_id = this.get_topic_id_from_topic_arn( topic_arn );

	console.log("PRE SEEDING API", topic_arn, confirmation_id, endpoint);
	/* Callbacks */

	var on_success = function( result ) {
		//TODO: Upgrade graph w/confirmation topic_arn
		console.log( 'API request was successful', result );
	};

	var on_error = function( result ) {
		console.log( 'API request was unsuccessful', result );
	};

	/* API Request */

	var request_url = this.build_api_call( "topic", topic_id, "confirm" );

	var user_object = {
		'user_id': user_id,
		'token': user_token
	};

	var post_data = {
		'id': topic_id,
		'method': 'confirm',
		'type': 'topic',
		'token': confirmation_id,
		'endpoint': endpoint,
		'customer_id': this.get_user_id(),
		'customer_token': this.get_user_token()
	};
	console.log("SEDING API REQ", user_object, request_url, post_data );
	this.send_api_request( user_object, request_url, post_data, true, false, on_success, on_error );

}

Reportorial.send_api_request = function( user_object, request_url, post_data, post, no_body, on_success ) {

	/* Defaults */

	if( !post ) {
		post = false;
	}

	if( !no_body ) {
		no_body = false;
	}

	var parsed = url.parse( request_url );

	var options = {
		host: parsed.host,
		port: 80,
		path: parsed.pathname,
	};

	options.method = ( post ) ? 'POST' : 'GET';

	if( 'GET' === options.method ) {
		options.path = parsed.path + '/?' + querystring.stringify( post_data );
	} 

	if( 'undefined' !== typeof user_object.user_id ) {
		console.log( "USER OBJ", user_object );
		if( 'undefined' === typeof options.headers ) {
			options.headers = {};
		}
		options.headers[ 'Authorization' ] = 'Basic ' + new Buffer( user_object.user_id + ':' + user_object.user_token ).toString('base64');


	}
	console.log( "REQIEST", options );
	var request = http.request( options, function( res ) {

		res.setEncoding('utf8');

		var raw = "";

		res.on("data", function(chunk) {
			raw += chunk;
		});

		res.on("end", function() {
			if( 'function' == typeof on_success ) {
				on_success( raw );
			}
		});
	} );

	if( 'POST' === options.method ) {
		request.write( JSON.stringify( post_data ) );
	}

	request.end();

};

var Public = function( server ) {
	
};

Public.prototype.id = function( val ) { 
	Reportorial.set_user_id( val );
};

Public.prototype.token = function( val ) { 
	Reportorial.set_user_token( val );
};

Public.prototype.subscribe = function( topic_id, endpoint ) { 
	console.log( 'Public.prototype.subscribe', topic_id, endpoint );
	if ( 'string' === typeof topic_id ) {
		Reportorial.subscribe_to_topic( topic_id, endpoint );
	} else {
		var x = 0, xlen = topic_id.length, xitem;
		for ( x = 0; x < xlen; x += 1 ) {
			xitem = topic_id[ x ];
			Reportorial.subscribe_to_topic( xitem, endpoint );
		}
	}
};

Public.prototype.unsubscribe = function( topic_id, endpoint ) { 
	console.log( 'Public.prototype.unsubscribe', topic_id, endpoint );
	if ( 'string' === typeof topic_id ) {
		Reportorial.unsubscribe_from_topic( topic_id, endpoint );
	} else {
		var x = 0, xlen = topic_id.length, xitem;
		for ( x = 0; x < xlen; x += 1 ) {
			xitem = topic_id[ x ];
			Reportorial.unsubscribe_from_topic( xitem, endpoint );
		}
	}
};


var stack = {};
Public.prototype.on = function( event_name, event_callback ) {
	if ( 'function' !== typeof event_callback ) {
		throw new Error( 'Callback must be a function' );
	}
	if ( 'undefined' === typeof stack[ event_name ] ) {
		stack[ event_name ] = [];
	}
	stack[ event_name ].push( event_callback );
	return this;
};

Public.prototype.trigger = function( event_name, event_context ) {
	if ( 'undefined' === typeof event_context ) {
		event_context = null;
	}
	var x = 0, xlen = stack[ event_name ].length; xitem;	
	for ( x = 0; x < xlen; x += 1 ) {
		xitem = stack[ event_name ][ x ];	
		xitem( event_context );
	}
}

Public.prototype.listen = function( io_app ) {
	var callb = function(req, res, next){

		req.setEncoding('utf8');

		var raw = "";

		req.on("data", function(chunk) {
			raw += chunk;
		});

		req.on("end", function() {
			console.log( 'Public.prototype.listen > callb() raw', raw );
			var type = req.params.type;
			var id = req.params.id;
			var method = req.params.method;
			var data = JSON.parse( raw );
			if( Reportorial.verify_incoming_message_is_subscription_confirmation_request( data, req.headers  ) ) {
				Reportorial.process_subscription_confirmation_request( data, req.headers  );
			} else if( Reportorial.verify_incoming_message_is_new_item_notification( data, req.headers  ) ) {
				Reportorial.process_new_item_notification( data, req.headers  );
			} else {
				console.log('none of the above');
			}
			res.statusCode = 200;
			res.write("OK");
			console.log( res.getHeader( 'Status' ) );	
		});


		//next();	
	};

	io_app.post('/:type/:id/:method?', callb );
//	io_app.get('/:type/:id/:method?', callb );

	return this;
};

module.exports = new Public();
