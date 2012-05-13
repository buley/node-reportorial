
var Reportorial = Reportorial || {};

Reportorial.get_user_id = function() {
	return "4e166cfe81b58";
}

Reportorial.get_user_token = function() {
	return "blah";
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

Reportorial.verify_incoming_message_is_subscription_confirmation_request = function( data ) {
	console.log( 'checking', data.Type );
	if( "undefined" !== typeof data && "SubscriptionConfirmation" === data.Type ) {
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
		tagged = new pos.Tagger().tag( message.object.content );
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
		//publish( topic, item, 'news', score, null );
	//	for( var j in item.entities ) {
	//		publish( item.entities[ j ], item, 'news', score, null );
	//	}
	} else {	
		console.log( "SHOULD BE PUBLISHED", topic, item, 'news', score, null );
		//publish( topic, item, 'news', score, null );
	}

};

Reportorial.process_subscription_confirmation_request = function( data ) {
	var topic_arn = data.TopicArn;
	var confirmation_id = data.Token;
	var endpoint = this.get_api_endpoint();
	this.confirm_subscription( topic_arn, confirmation_id, endpoint );
};

Reportorial.subscribe_to_topic = function( topic_arn, endpoint ) {

	var post_data = { 'endpoint': endpoint, 'protocol': 'http' };
	var user_id = this.get_user_id();
	var user_token = this.get_user_token();
	var topic_id = this.get_topic_id_from_topic_arn( topic_arn );
	var request_url = this.build_api_call( 'topic', topic_id, 'subscribe', user_id, user_token );

	var on_success = function( result ) {
		console.log("subscribed to topic successfully", result );
	}

	var on_error = function( result ) {
		console.log("could not subscribe to topic", result );
	}

	Reportorial.send_api_request( { 'user_id': user_id, 'user_token': user_token }, request_url, post_data, true );

};


Reportorial.unsubscribe_from_topic = function( topic_arn, endpoint ) {

	var post_data = { 'endpoint': endpoint, 'protocol': 'http' };
	var user_id = this.get_user_id();
	var user_token = this.get_user_token();
	var topic_id = Reportorial.get_topic_id_from_topic_arn( topic_arn );
	var request_url = Reportorial.build_api_call( 'topic', topic_id, 'unsubscribe' );

	var on_success = function( result ) {
		console.log("unsubscribed from topic successfully", result );
	}

	var on_error = function( result ) {
		console.log("could not unsubscribe from topic", result );
	}

	Reportorial.send_api_request( { 'user_id': user_id, 'user_token': user_token }, request_url, post_data, true );

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
		return api_endpoint + "/" + type + "/" + slug + "/" + method;
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
	var topic_id = Reportorial.get_topic_id_from_topic_arn( topic_arn );

	/* Callbacks */

	var on_success = function( result ) {
		//TODO: Upgrade graph w/confirmation topic_arn
		console.log( 'API request was successful', result );
	};

	var on_error = function( result ) {
		console.log( 'API request was unsuccessful', result );
	};

	/* API Request */

	var request_url = Reportorial.build_api_call( "topic", topic_id, "confirm" );

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

	Reportorial.send_api_request( user_object, request_url, post_data, true, false, on_success, on_error );

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
		path: parsed.path,
	};

	options.method = ( post ) ? 'POST' : 'GET';

	if( 'GET' === options.method ) {
		options.path = parsed.path + '/?' + querystring.stringify( post_data );
	} 

	if( 'undefined' !== typeof user_object.user_id ) {
		if( 'undefined' === typeof options.header ) {
			options.header = {};
		}
		options.header[ 'Authorization' ] = 'Basic ' + new Buffer( user_object.user_id + ':' + user_object.token ).toString('base64');

	}

	var request = http.request( options, function( res ) {

		res.setEncoding('utf8');

		var raw = "";

		req.on("data", function(chunk) {
			raw += chunk;
		});

		req.on("end", function() {
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

module.exports = Reportorial;
