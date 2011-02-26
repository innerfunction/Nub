/**
 * jquery.nub.js
 * An MVC and navigation framework for producing multi-screen UIs using jQuery.
 *
 * Copyright (c) 2011 InnerFunction Ltd.
 * Dual licensed under the MIT (MIT-LICENSE.txt) and GPL (GPL-LICENSE.txt) licenses.
 *
 * Nub provides an MVC architecture which allows views which register with the controller to receive
 * notification whenever the part of the model which they are interested in is updated. Nub provides
 * a single root model. Child models can be inserted into this root model to provide new behaviours.
 * Different model types can choose how to represent the data they contain, and can, for example,
 * use the DOM itself as the data store.
 *
 * All data items are referenced using a data path composed of property names separated by forward
 * slashes. The interpretation of the data path depends on model type. The standard model interprets
 * the data path as a sequence of nested property names, i.e. the data path is equivalent to the
 * dotted notation used to reference nested JS properties.
 *
 * Views are registered with the MVC using the data path of a data item. All views are functions
 * which are called whenever the observed data item is updated or deleted. Nub provides a number
 * of standard functions for turning HTML elements into views.
 *
 * @author Julian Goacher
 * @version 2.0.1
 */
(function($) {
    /** The nub namespace. */
    $.nub = {
        /** The identity function. */
        identity: function( a ) { return a; },
        /** A no-op (i.e. do nothing) function. */
        noop: function() {},
        /** A function which takes a value and returns a function which always returns that value. */
        constant: function( c ) { return function() { return c; }; },
        /** Functions for creating filter criteria. */
        criteria: {
            equals: function( id, value, nonEmptyValue ) {
                if( value === undefined ) return $.nub.constant( true );
                if( !value && nonEmptyValue ) return $.nub.constant( true );
                return function( obj ) {
                    return obj !== undefined && obj[id] == value;
                };
            },
            lte: function( id, value ) {
                if( value === undefined ) return $.nub.constant( true );
                return function( obj ) {
                    return obj !== undefined && obj[id] <= value;
                }
            },
            gte: function( id, value ) {
                if( value === undefined ) return $.nub.constant( true );
                return function( obj ) {
                    return obj !== undefined && obj[id] >= value;
                }
            }
        }
    }
    /** Test whether an object is a data model. */
    function isModel( obj ) {
        return obj !== undefined && obj['nub:isModel'] && $.isFunction( obj.resolve );
    }
    /** Prototype model. */
    function PrototypeModel() {
        this['nub:isModel'] = true;
    }
    $.nub.PrototypeModel = PrototypeModel;

    StandardModel.prototype = new PrototypeModel();
    /**
     * The standard data model. Interprets the data path as a nested object reference.
     * Delegates data lookup to any child models it encounters.
     */
    function StandardModel( data ) {
        $.extend( this, data );
    }
    /**
     * Resolve a data item in the model and apply the specified op to it.
     * @op:     The operation to perform - get, set or del(ete).
     * @pathIt: An iterator over the data path.
     * @value:  The value (for a 'set' operation).
     * @obj:    The object to resolve properties against. Defaults to this.
     */
    StandardModel.prototype.resolve = function( op, pathIt, value, obj ) {
        obj = obj||this;
        while( obj !== undefined && pathIt.next() ) {
            var prop = pathIt.head();
            if( obj[prop] === undefined ) {
                // If setting property and a parent property doesn't exist then create
                // an empty object.
                if( 'set' == op ) {
                    obj[prop] = {};
                }
            }
            obj = obj[prop];
            if( isModel( obj ) ) { // Delegate if child model found.
                return obj.resolve( op, pathIt, value );
            }
        }
        if( obj === undefined ) return undefined;
        return this[op]( obj, pathIt.last(), value );
    }
    StandardModel.prototype.get = function( obj, prop ) {
        return obj[prop];
    }
    StandardModel.prototype.set = function( obj, prop, value ) {
        return obj[prop] = value;
    }
    StandardModel.prototype.del = function( obj, prop, value ) {
        value = obj[prop];
        delete obj[prop];
        return value;
    }
    $.nub.StandardModel = StandardModel;
    
    ViewModel.prototype = new PrototypeModel();
    /** The data model used to store MVC views. */
    function ViewModel() { this['nub:views'] = []; }
    /** Build a list of all mvc views associated with a node in the view model. */
    ViewModel.gatherViews = function( node, list, deep ) {
        if( node ) {
            // Copy all views on the node which aren't already active.
            for( var i = 0, views = node['nub:views']; views && i < views.length; i++ ) {
                if( !views[i].active ) list.push( views[i] );
            }
            // If 'deep' is true then include all views on all sub-nodes.
            if( deep ) {
                for( var id in node ) {
                    if( id != 'nub:views' ) list = this.gatherViews( node[id], list, true );
                }
            }
        }
        return list;
    }
    /** Resolve a model data node, initializing a new one if necessary. */
    ViewModel.prototype.node = function( node, prop ) {
        if( node[prop] === undefined ) {
            node[prop] = { 'nub:views':[] };
        }
        return node[prop];
    }
    ViewModel.prototype.resolve = function( op, pathIt, value ) {
        var node = this, context = [ node ];
        while( pathIt.next() ) {
            node = this.node( node, pathIt.head() );
            context.push( node );
        }
        return this[op]( this.node( node, pathIt.last() ), context, value );
    }
    ViewModel.prototype.get = function( node, context, value ) {
        return { node: node, context: context };
    }
    ViewModel.prototype.set = function( node, context, value ) {
        var views = node['nub:views'];
        views.push( value );
        return views;

    }
    ViewModel.prototype.del = function( node, context, value ) {
        var views = node['nub:views'];
        for( var i = 0; i < views.length; i++ ) {
            if( views[i] === value ) {
                views.splice( i, 1 );
                break;
            }
        }
    }
    /** The root data model. */
    $.nub.model = new StandardModel({
        'nub:viewroot': new ViewModel(), // Registered model views.
        'nub:forms': {} // Registered HTML forms.
    });
    /** Object referencing any HTML form models registered with nub. */
    var forms = $.nub.model['nub:forms'];
    HTMLFormModel.prototype = new PrototypeModel();
    /** Counter used to generate unique names for unnamed forms. */
    HTMLFormModel.prototype.counter = 0;
    /** A data model which stores its data in an HTML form. */
    function HTMLFormModel( form ) {
        this.form = form;
        this.name = form.getAttribute('name')||'form'+(this.counter++);
        forms[this.name] = this;
        var context = $.nub.path( this.name, 'nub:forms');
        for( var i = 0; i < form.elements.length; i++ ) {
            $(form.elements[i]).bind('change', function() {
                var path = $.nub.path( this.name, context );
                $.nub.notify('set', path );
            });
        }
        // Notify any observers that the form has been inserted into the model.
        $.nub.notify('set', context );
    }
    HTMLFormModel.prototype.resolve = function( op, pathIt, value ) {
        pathIt.next();
        return this[op]( pathIt.rest(), value );
    }
    HTMLFormModel.prototype.get = function( name, value ) {
        return $( this.form.elements[name] ).val();
    }
    HTMLFormModel.prototype.set = function( name, value ) {
        return $( this.form.elements[name] ).val( value );
    }
    HTMLFormModel.prototype.del = function( name, value ) {
        this.set( name, '' );
    }
    HTMLFormModel.prototype.serialize = function() {
        return $(this.form).serialize();
    }
    HTMLFormModel.prototype.values = function() {
        var elems = this.form.elements, values = {}, name;
        for( var i = 0; i < elems.length; i++ ) {
            name = elems[i].name;
            values[name] = this.get( name );
        }
        return values;
    }
    HTMLFormModel.prototype.setData = function( data, callbacks ) {
        var cx = 'nub:forms/'+this.name, elems = this.form.elements;
        for( var i = 0; i < elems.length; i++ ) {
            var name = elems[i].name;
            $.nub.set( name, data[name], cx );
        }
        if( $.isFunction( callbacks.success ) ) {
            callbacks.success.apply( this, arguments );
        }
    }
    HTMLFormModel.prototype.load = function( opts ) {
        opts = opts||{};
        var form = this;
        var url = opts.url||this.form.action;
        $.ajax({
            type:       'GET',
            url:        url,
            success:    function( data ) { form.setData( data, opts ); },
            error:      opts.error,
            complete:   opts.complete
        });
    }
    HTMLFormModel.prototype.submit = function( opts ) {
        opts = opts||{};
        var form = this;
        var url = opts.url||this.form.action;
        $.ajax({
            type:       this.form.method,
            url:        url,
            data:       this.serialize(),
            success:    function( data ) { form.setData( data, opts ); },
            error:      opts.error,
            complete:   opts.complete
        });
    }

    RemoteModel.prototype = new StandardModel();
    /** A data model for referencing remote data loaded from a RESTful interface. */
    function RemoteModel( opts, ref ) {
        this.ref = $.nub.path( ref );
        this.meta = { status: 'preload' };
        this.data = undefined;
        // Allow the basic object to be extended with custom handlers.
        $.extend( this, {
            // Serialize the data prior to an update. Default serializes to a JSON string.
            serialize: function() { return JSON.stringify( this.data ); },
            // Process a request before it is submitted. The function is passed an object with the
            // following properties and should return the modified argument.
            // - url, type, dataType, success, error: See load() method below for details.
            onrequest: $.nub.identity,
            // Process a response before the model is updated. The function is passed two arguments.
            // The first argument is the complete 'remote' object about to be written into the model.
            // The second argument is the HTTP method used for the request. The value returned by the
            // function is the value which will be copied into the model. See the update() function.
            onload: $.nub.identity
        }, opts );
    }
    RemoteModel.prototype.loaded = function() {
        var status = this.meta.status;
        return status !== undefined && !status.match(/^(preload|loading|submitting)/);
    }
    RemoteModel.prototype.resolve = function( op, pathIt, value ) {
        return StandardModel.prototype.resolve.apply( this, [ op, pathIt, value ] );
    }
    /**
     * Execute a callback function once the load point's data is available. Will execute immediately
     * if the data is already loaded. The callback will only be executed once if 'repeat' is false,
     * otherwise the callback is executed each time data is loaded.
     */
    RemoteModel.prototype.whenAvailable = function( callback, repeat ) {
        var view = function() {
            var lp = $.nub.get( this.ref );
            if( lp.loaded() ) {
                try {
                    callback( lp );
                }
                finally {
                    if( !repeat ) $.nub.removeView('meta/status', view, this.ref );
                }
            }
        };
        $.nub.view('meta/status', view, this.ref );
    }
    /** Update the model with a http response. */
    RemoteModel.prototype.update = function( uri, status, method, data, error) {
        // Construct an object to replace the remote object currently in the model.
        var remote = this.onload( $.extend( {}, this, {
            'meta': {
                'error':       error,
                'uri':         uri,
                'timestamp':   new Date(),
                'ajax-status': status,
                'status':      'loaded',
                'initData':    JSON.stringify( data )
            },
            'data': data
        } ), method );
        $.nub.set( this.ref, remote );
    }
    /**
     * Load data into the model load point. Uses an HTTP GET (unless specified otherwise in the
     * 'options' argument). The function creates a wrapper object for the data, with two properties,
     * 'meta' and 'data'. The loaded data is placed under the 'data' property, whilst information
     * about the loaded data is placed in the 'meta' object. Meta-data includes the URI the data
     * was requested from, the load status (one of 'preload', 'loaded', 'loading', 'submitting' or
     * 'error'), and an error object when in an error state.
     */
    RemoteModel.prototype.load = function( options ) {
        var remote = this;
        var success = options.success||$.nub.model.options.remote.success;
        var error = options.error||$.nub.model.options.remote.error;
        var args = $.extend( { type: 'GET' }, options );
        args.success = function( data, status ) {
            remote.update( options.url, status, 'GET', data );
            success.apply( remote, [ data, status ] );
        }
        args.error = function( xhr, status, err ) {
            remote.update( options.url, status, 'GET', undefined, err );
            error.apply( this, [ xhr, status, err ] );
        }
        args = remote.onrequest( args );
        $.nub.set('meta/status', args.type == 'GET' ? 'loading' : 'submitting', this.ref );
        $.nub.set('meta/dataType', options.dataType, this.ref );
        return $.ajax( args );
    }
    /**
     * Parse the arguments passed to a load function (httpGet,httpPut,httpPost,reload) and return
     * a standard options object. The function interprets argument by type. The mappings are:
     * string -> URI to request
     * function -> success callback
     * object -> options object
     */
    RemoteModel.prototype.parseLoadArguments = function() {
        var options = {};
        for( var i = 0; i < arguments.length; i++ ) {
            if( typeof( arguments[i] ) == 'string' ) {
                options = $.extend( options, { url: arguments[i] } );
            }
            else if( $.isFunction( arguments[i] ) ) {
                options = $.extend( options, { success: arguments[i] } );
            }
            else if( $.isPlainObject( arguments[i] ) ) {
                options = $.extend( options, arguments[i] );
                options.url = options.uri;
            }
        }
        return options;
    }
    RemoteModel.prototype.httpGet = function() {
        var options = $.extend({
            type: 'GET',
            dataType: 'json'
        }, this.parseLoadArguments.apply( this, arguments ));
        return this.load( options );
    }
    RemoteModel.prototype.httpPut = function() {
        var options = $.extend({
            type: 'PUT',
            uri: this.meta.uri,
            dataType: 'json',
            data: this.serialize()
        }, this.parseLoadArguments.apply( this, arguments ));
        return this.load( options );
    }
    RemoteModel.prototype.httpPost = function() {
        var options = $.extend({
            type: 'POST',
            dataType: 'json',
            data: this.serialize()
        }, this.parseLoadArguments.apply( this, arguments ));
        return this.load( options );
    }
    /** Reload the currently loaded data. */
    RemoteModel.prototype.reload = function() {
        if( this.meta.status == 'loaded' ) {
            var options = $.extend({
                uri: this.meta.uri,
                dataType: this.meta.dataType
            }, this.parseLoadArguments.apply( this, arguments ));
            return this.load( options );
        }
    }
    /** Reset the data to its original loaded state. */
    RemoteModel.prototype.reset = function() {
        $.nub.set('data', JSON.parse( this.meta.initData ), ref );
    }
    $.nub.RemoteModel = RemoteModel;

    /** Different nub configuration options. */
    $.nub.model.options = {
        // The default context for relative data references.
        //globalContext: '/data',
        // The attribute used to read data references from elements.
        refAttr: 'data',
        // The default view element selector.
        viewSelector: '.nub-view',
        // The default view context selector.
        contextSelector: '.nub-context',
        // The default form model selector.
        formSelector: 'form.nub-form',
        // The default select list view selector.
        selectSelector: '.nub-select',
        // Regex pattern for matching attribute values referencing a data item.
        attrRefPattern: /^#?nub:(.*)$/,
        // Default function for testing whether an element is an input element.
        isInput: function( elem ) { return !!elem.type && elem.type != 'button'; },
        // Default function for reading a data reference from an element.
        getRef: function( elem ) { return $(elem).attr( $.nub.model.options.refAttr ); },
        // Default function for reading a data reference from an input element.
        getInputRef: function( elem ) { return elem.name; },
        // Resolve the format options for a node.
        readFormatOptions: function( elem, fopts ) {
            return $.extend( {}, $.nub.model.options.formatOptions, fopts );
        },
        // Registered value formatters. Each formatter object must have format() and parse()
        // methods. Both methods take 'value' and 'formatOption' arguments and return the
        // modified value.
        formatters: {},
        // Default options for formatting (and parsing) model values.
        formatOptions: {},
        // The default 'change' event handler for input's registered with the model.
        /*
        changeHandler: function( event ) {
            $.nub.set( this.name, $(this).val(), event.data[0], event.data[1] );
        },
        */
        // The default function for reading an input value.
        readInputValue: function( input ) {
            return $(input).val();
        },
        // The default function for reading a checkbox value.
        readCheckboxValue: function( cb ) {
            return $(cb).is(':checked');
        },
        // The default form input view function.
        inputView: function( input, value ) {
            $(input).val( value );
        },
        // The default checkbox input view function.
        checkboxView: function( cb, value ) {
            $(cb).attr('checked', value );
        },
        // The default element view function.
        elemView: function( elem, value ) {
            $(elem).html( value );
        },
        // The default attribute view function.
        attrView: function( attr, value ) {
            attr.value = value;
        },
        // The default text node view function.
        textView: function( text, value ) {
            $(text).text( value );
        },
        // Default Remote object options
        remote: { success: $.nub.noop, error: $.nub.noop }
    }
    /** If the metadata plugin is available then utilise it when reading an element's format options. */
    if( $.metadata !== undefined ) {
        $.nub.model.options.readFormatOptions = function( elem, fopts ) {
            return $.extend( $.nub.model.options.formatOptions, fopts, $.metadata.get( elem ) );
        }
    }
    /** Return a view for populating select lists. Source data must be either a 1D or 2D array. */
    function selectListView( elem, ref, context ) {
        var offset = elem.options.length; // Preserve any options already on the select list.
        return function() {
            var list = $.nub.get( ref, context );
            var i, j, len = list !== undefined ? list.length||0 : 0;
            // Populate the select list.
            for( i = 0, j = offset; i < len; i++, j++ ) {
                if( list[i] instanceof Array ) { // => [ value, label ]
                    elem.options[j] = new Option( list[i][1], list[i][0] );
                }
                else elem.options[j] = new Option( list[i] ); // => label only.
            }
            // Remove any used options.
            for( j = j; j < elem.options.length; j++ ) elem.options[j] = undefined;
        };
    }
    /** Read a model data reference from a node. */
    function getNodeRef( node ) {
        return node.getAttribute( $.nub.model.options.refAttr );
    }
    /**
     * An iterator over a data path's components. The object iterates from the first (0) component
     * to the second last (length - 2) component; the last component is accessed using the last()
     * method.
     */
    function PathIterator( path ) {
        var idx = -1;
        // Return the head path component.
        this.head = function() { return path[idx]; };
        // Return the remainer of the path from the head position.
        this.rest = function() { return path.slice( idx ).join('/'); };
        // Move to the next path component. Return true if not at end of path.
        this.next = function() { return ++idx < path.length - 1; };
        // Return the last path component.
        this.last = function() { return path[path.length - 1]; };
        // Return the path being iterated over.
        this.path = function() { return path; };
    }
    /** Promote an array containing a model data reference into a path. */
    function promoteToPath( ref, absolute ) {
        ref.toString = function( i ) {
            return (this.isAbsolute ? '/' : '')+(isNaN( i ) ? this : this.slice( 0, i + 1 )).join('/');
        }
        ref.copy = function() {
            return promoteToPath( this.slice( 0 ) );
        }
        ref.inContext = function( context ) {
            var path = $.nub.path( context ).slice( 0 );
            for( var i = 0; i < this.length; i++ ) {
                path.push( this[i] );
            }
            return $.nub.path( path );
        }
        // Return an iterator of all path components up to but excluding the last component.
        ref.iterator = function() {
            return new PathIterator( this );
        }
        ref.isAbsolute = absolute;
        ref.isModelPath = true;
        return ref;
    }
    /* Global MVC functions. */
    /** Turn a model data reference into a model path. */
    $.nub.path = function( ref, context ) {
        ref = ref||[];
        var path;
        if( ref.isModelPath ) {
            path = ref;
        }
        else if( $.isArray( ref ) ) {
            path = promoteToPath( ref, true );
        }
        /* Disabled reading of data ref from element attributes
        else if( ref.nodeType ) {
            var refs = [];
            var accumRefs = function() {
                var nodeRef = getNodeRef( this );
                if( nodeRef !== null ) {
                    refs.unshift( nodeRef );
                    if( nodeRef.charAt( 0 ) == '/' ) throw true;
                }
            };
            try {
                accumRefs.apply( ref );
                $( ref ).parents().each( accumRefs );
            }
            catch( e ) {}
            path = promoteToPath( ref );
        }
        */
        else if( typeof( ref ) == 'string' ) {
            var absolute = ref.charAt(0) == '/';
            var refs = ref.split('/');
            // Strip empty path components from start and end caused by leading/trailing slashes.
            if( refs[0] == '' ) refs.shift();
            while( refs[refs.length - 1] == '' ) refs.length--;
            // Convert to absolute path
            path = promoteToPath( refs, absolute );
        }
        if( !path.isAbsolute && context !== undefined ) {
            path = path.inContext( context );
        }
        return path;
    }
    /** Get a referenced value. */
    $.nub.get = function( ref, context ) {
        var pathIt = $.nub.path( ref, context ).iterator();
        return $.nub.model.resolve('get', pathIt );
    }
    /** Set a referenced value. */
    $.nub.set = function( ref, value, context ) {
        var path = $.nub.path( ref, context );
        var result = $.nub.model.resolve('set', path.iterator(), value );
        $.nub.notify('set', path );
    }
    /** Delete a referenced value. */
    $.nub.del = function( ref, value, context ) {
        var path = $.nub.path( ref, context );
        var result = $.nub.model.resolve('del', path.iterator(), value );
        $.nub.notify('del', path );
    }
    /** Send notification of an update to part of a model to all views observing that part. */
    $.nub.notify = function( op, path ) {
        var viewNodes = $.nub.get( path.inContext('nub:viewroot') );
        var views = [], node, context;
        if( viewNodes.node && viewNodes.context ) {
            node = viewNodes.node;
            context = viewNodes.context;
        }
        else { // => empty path, node is the view model root object.
            node = {};
            // Only copy non-prototype properties of the object.
            for( var id in viewNodes ) if( viewNodes.hasOwnProperty( id ) ) node[id] = viewNodes[id];
            context = [];
        }
        for( var i = 0; i < context.length; views = ViewModel.gatherViews( context[i++], views ) );
        views = ViewModel.gatherViews( node, views, true );
        if( views ) {
            $.each( views, function( i, view ) {
                try {
                    view.active = true;
                    view( op, path );
                }
                catch( e ) {
                    if( console !== undefined ) console.error('Notifying view: %o', e );
                }
                finally {
                    view.active = false;
                }
            });
        }
    }
    /**
     * Return a view function which formats the value read from the model. Attempts to read
     * formatting objects from the view node and then to use the defined formatter to 
     * format the model value before passing it to the view function.
     * @path:   Path to the data item being viewed.
     * @elem:   The element being used to display the value.
     * @viewFn: The function used to display the value.
     */
    function formattingView( path, node, viewFn ) {
        // Resolve any view options on the node.
        var opts = $.nub.model.options;
        var fopts = opts.readFormatOptions( node );
        return function() {
            var value = $.nub.get( path );
            // Attempt resolving a formatter object.
            var formatter = opts.formatters[fopts.formatter];
            // If one is found then use it to format the value.
            if( formatter ) {
                value = formatter.format( value, fopts );
            }
            else if( value === undefined ) value = '';
            // Invoke the view function.
            viewFn( node, value );
        }
    }
    /** Add a model view. 'obj' should be either a HTML node or a callback function. */
    $.nub.view = function( ref, obj, context, noinit ) {
        var path = $.nub.path( ref, context );
        var fn;
        if( $.isFunction( obj ) ) {
            fn = obj;
        }
        else if( obj.type ) { // Input
            var view = obj.type == 'checkbox'
                ? $.nub.model.options.checkboxView
                : $.nub.model.options.inputView;
            fn = formattingView( path, obj, view );
        }
        else switch( obj.nodeType ) {
            case 1: // Element
                fn = formattingView( path, obj, $.nub.model.options.elemView );
                break;
            case 2: // Attribute
                fn = formattingView( path, obj, $.nub.model.options.attrView );
                break;
            case 3: // Text
                fn = formattingView( path, obj, $.nub.model.options.textView );
                break;
            default:
                throw new Error("View must be a HTML element, attribute or text node, or a function");
        }
        // Add the view to the model.
        var viewPath = path.inContext('nub:viewroot');
        $.nub.set( viewPath, fn );
        // Invoke the callback to initialize the view.
        if( !noinit ) {
            fn('set', path );
        }
        return fn;
    }
    /** Remove a model view. */
    $.nub.removeView = function( ref, obj, context ) {
        $.nub.del( $.nub.path( ref, context ).inContext('nub:viewroot'), obj );
    }
    /** Register a form input with the model. */
    $.nub.input = function( node, context, opts ) {
        var fopts = $.nub.model.options.readFormatOptions( node );
        var readValue = node.type == 'checkbox'
            ? $.nub.model.options.readCheckboxValue
            : $.nub.model.options.readInputValue;
        var onchange = function( event ) {
            //var value = $(node).val();
            var value = readValue( node );
            var formatter = $.nub.model.options.formatters[fopts.formatter];
            if( formatter ) {
                value = formatter.parse( value, fopts );
            }
            $.nub.set( node.name, value, context );
        }
        return $(node).bind('change', [ context, opts ], onchange );
    }
    $.nub.remote = function( ref, opts ) {
        var remote = new RemoteModel( opts, ref );
        $.nub.set( ref, remote );
        return remote;
    }
    /**
     * Create a data filter. A filter observes data in one section of the model and generates
     * data in another section by applying a function to the source data. A filter can also
     * have arguments which are also stored in the model.
     * The filter function is invoked as a method on the source data whenever the source data
     * or the filter arguments are updated. The value returned by the function is the filter
     * result and is used to update the model at the specified filter location.
     * The filter arguments are stored in the 'args' property at the filter location. The
     * filter result is stored in the 'result' property at the filter location.
     * @filterRef:  The filter's location in the model.
     * @dataRef:    The filter's source data location.
     * @filterFn:   The filter function.
     */
    $.nub.filter = function( filterRef, dataRef, filterFn ) {
        $.nub.set( filterRef, { 'filter:args': {} } );
        // A functional view for invoking the filter function.
        function filterView( op, path ) {
            var value = $.nub.get( dataRef );
            var args = $.nub.get('filter:args', filterRef );
            $.nub.set( filterRef, $.extend( filterFn( value, args ), { 'filter:args':args } ) );
        }
        // Invoke the filter when the source data is updated.
        $.nub.view( dataRef, filterView );
        // Invoke the filter when the filter arguments change.
        $.nub.view('filter:args', filterView, filterRef, true );
    }
    /**
     * Initializers invoked by the $.nub.init function. Each initializer function is invoked as
     * a method on each of the nodes matching the selector expression as specified by the in-scope
     * Nub options (see the init function). The in-scope Nub options are passed as an argument to
     * the initializer function.
     * Nub extensions can register their own initializer functions in this object so that they are
     * called by the init function.
     */
    $.nub.initializers = {
        'viewSelector': function( node, opts ) {
            var context = $(node).parents( opts.contextSelector ).attr('data');
            // Check for a data reference.
            var input = opts.isInput( node );
            var ref = input ? opts.getInputRef( node ) : opts.getRef( node );
            // Register view if ref found.
            if( ref ) {
                $.nub.view( ref, node, context );
                if( input ) {
                    $.nub.input( node, context );
                }
            }
            // Check attributes for attribute views.
            var attrs = node.attributes;
            for( var i = 0; i < attrs.length; i++ ) {
                // If attribute value matches the reference pattern...
                var r = opts.attrRefPattern.exec( attrs[i].value );
                if( r ) {
                    // ...then register the view using the first match group as the data reference.
                    $.nub.view( r[1], attrs[i], context );
                }
            }
        },
        'formSelector': function( node, opts ) {
            new HTMLFormModel( node );
        },
        'selectSelector': function( node, opts ) {
            // Select lists with a 'data' attribute load their option list from the MVC.
            if( node.type == 'select-one' || node.type == 'select-many' ) {
                var context = $(node).parent( opts.contextSelector ).attr('data');
                var data = $(node).attr('data');
                if( data ) {
                    // Add a view to populate the select list.
                    $.nub.view( data, selectListView( node, data, context ), context );
                }
            }
        }
    };
    /**
     * Initialize any models or views within the DOM.
     * @cx: Element or jQuery object to use as the initialization context (i.e. only elements contained
     *      by the context will be initialized. Optional, defaults to the document body.
     * @opts: Customization options to use for this initialization only (optional).
     *        See $.nub.model.options for a list of customizable options.
     */
    $.nub.init = function( cx, opts ) {
        var opts = $.extend( {}, $.nub.model.options, opts );
        var inits = $.nub.initializers;
        for( var id in inits ) {
            // opts[id] is a selector expression - i.e. value of opts.viewSelector, opts.formSelector.
            $( opts[id], cx ).each(function() {
                inits[id]( this, opts );
            });
        }
    }
})(jQuery);
