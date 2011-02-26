/**
 * jquery.nub-list.js
 * A list framework for Nub. Provides paged lists for displaying data stored in the Nub model
 * using TABLE, UL or OL elements.
 *
 * Copyright (c) 2011 InnerFunction Ltd.
 * Dual licensed under the MIT (MIT-LICENSE.txt) and GPL (GPL-LICENSE.txt) licenses.
 *
 * @author Julian Goacher
 * @version 2.0.0
 */
(function($) {
    // Counter for generating unique list IDs.
    var listCounter = 0;
    // Utility function for filtering a list of nodes.
    function filterNodes( ns, test ) {
        for( var i = 0, r = []; i < ns.length; i++ ) {
            if( test( ns[i] ) ) r.push( ns[i] );
        }
        return r;
    }
    /**
     * List object constructor.
     * @elem:       The list element; normally a TABLE or UL element.
     * @dataRef:    Reference to the list's source data. Should be an array of row data objects.
     * @opts:       List configuration options. See $.nubList().
     */
    function List( elem, dataRef, opts ) {
        this.elem = elem; // The list element.
        switch( elem.tagName ) {
        case 'TABLE':
            this.getRows = function() { return this.elem.rows; }
            break;
        case 'UL':
        case 'OL':
            this.getRows = function() {
                // Return all LI children.
                return filterNodes( this.elem.childNodes, function( n ) { return n.tagName == 'LI'; } );
            }
            break;
        default:
            this.getRows = function() {
                // Return all element children.
                return filterNodes( this.elem.childNodes, function( n ) { return n.nodeType == 1; } );
            }

        }
        opts = $.extend( opts, { viewSelector: '.nub-list-view' } );
        // Create the paging filter. This filter takes the list's source data and extracts the rows
        // for the current list page.
        this.filterRef = $.nub.path( dataRef ).inContext('nub:listFilters');
        $.nub.filter( this.filterRef, dataRef, function( data, args ) {
            data = $.isArray( data ) ? data : [];
            var lastPage = Math.ceil( data.length / args.pageSize );
            if( lastPage == 0 ) lastPage = 1; // Always one page, even if empty.
            // Sanity check the current page number
            if( args.page > lastPage ) {
                args.page = lastPage;
            }
            var offset = args.pageSize * (args.page - 1);
            // Return a slice of the row array (this) corresponding to the current page.
            return {
                // The last page number (i.e. the total number of pages).
                lastPage: lastPage,
                // The row data for the current page.
                pageRows: data.slice( offset, offset + args.pageSize )
            };
        });
        $.nub.set('filter:args', { page: 1, pageSize: opts.rowCount }, this.filterRef );
        // Start processing list rows.
        var list = this;
        var $list = $(elem);
        var rowsRef = $.nub.path('pageRows', this.filterRef ); // The rows of the current list page.
        // Clone the template row to generate the required number of list rows.
        var $row = $('.nub-list-row:first', elem ).addClass('nub-context');
        $row.attr('data', $.nub.path( '0', rowsRef ).toString() ); // Data ref context.
        $row.remove(); // Remove the template row from the DOM.
        // Offset to allow for header rows - once template row is removed, rest are headers.
        var offset = this.getRows().length;
        // Add/remove list rows when the list page size changes.
        $.nub.view('filter:args/pageSize', function() {
            var rowCount = $.nub.get('filter:args/pageSize', list.filterRef ) + offset; // +offset for the header
            var rows = list.getRows();
            if( rows.length < rowCount ) {
                for( var i = rows.length; i < rowCount; i++ ) {
                    var cx = $.nub.path( (i - offset).toString(), rowsRef ).toString(); // -offset for the header
                    var $tr = $row.clone().attr('data', cx );
                    $list.append( $tr );
                    $.nub.init( $tr, opts ); // Initialize any views within the row.
                    // Add any click/row select handlers.
                    if( opts.click || opts.selectCSS ) {
                        $tr.click(function() {
                            var $tr = $(this);
                            if( list.selected && opts.selectCSS ) {
                                list.selected.removeClass( opts.selectCSS );
                            }
                            list.selected = $tr;
                            if( opts.selectCSS ) {
                                list.selected.addClass( opts.selectCSS );
                            }
                            if( opts.click ) {
                                opts.click( $tr );
                            }
                        });
                    }
                    // Add any row hover handlers.
                    if( opts.hoverCSS ) {
                        $tr.hover(
                            function() { $(this).addClass( opts.hoverCSS ) },
                            function() { $(this).removeClass( opts.hoverCSS ) }
                        );
                    }
                }
            }
            else for( var i = rowCount; i < rows.length; i++ ) {
                $(rows[i]).remove();
            }
        }, this.filterRef );
        if( $.isFunction( opts.onpage ) ) {
            // Setup onpage callback handler.
            $.nub.view('filter:args/page', function() {
                opts.onpage.apply( list, [ $.nub.get( list.filterRef ) ] );
            }, this.filterRef );
        }
        if( opts.hideEmptyRows ) {
            // Register view to hide rows for which there is no data.
            $.nub.view( this.filterRef, function() {
                var data = $.nub.get( rowsRef );
                var len = data ? data.length : 0; // Length of the current page.
                len += offset; // Allow for the header row.
                var rows = list.getRows();
                for( var i = offset; i < rows.length; i++ ) {
                    // Show rows before page end, hide rows past page end.
                    $(rows[i])[ i < len ? 'show' : 'hide' ]();
                }
            });
        }
        else if( opts.emptyRowCSS ) {
            // Register view to hide rows for which there is no data.
            $.nub.view( this.filterRef, function() {
                var data = $.nub.get( rowsRef );
                var len = data ? data.length : 0; // Length of the current page.
                len += offset; // Allow for the header row.
                var rows = list.getRows();
                for( var i = offset; i < rows.length; i++ ) {
                    if( i < len ) {
                        $(rows[i]).removeClass( opts.emptyRowCSS );
                    }
                    else {
                        $(rows[i]).addClass( opts.emptyRowCSS );
                    }
                }
            });
        }
    }
    // Get the current list page size.
    List.prototype.getPageSize = function() {
        return $.nub.get('filter:args/pageSize', this.filterRef );
    }
    // Set the list page size. Resizes the number of list rows.
    List.prototype.setPageSize = function( pageSize ) {
        if( pageSize < 1 ) pageSize = 1;
        $.nub.set('filter:args/pageSize', pageSize, this.filterRef );
    }

    // Click callback functions for page icons.
    var pagerIconClickFns = {
        first: function( filterRef ) {
            return function() { $.nub.set('filter:args/page', 1, filterRef ) };
        },
        prev: function( filterRef ) {
            return function() {
                var page = $.nub.get('filter:args/page', filterRef );
                if( page > 1 ) {
                    $.nub.set('filter:args/page', page - 1, filterRef );
                }
            }
        },
        next: function( filterRef ) {
            return function() {
                var data = $.nub.get( filterRef );
                var page = $.nub.get('filter:args/page', filterRef );
                if( page < data.lastPage ) {
                    $.nub.set('filter:args/page', page + 1, filterRef );
                }
            };
        },
        last: function( filterRef ) {
            return function() {
                $.nub.set('filter:args/page', $.nub.get('lastPage', filterRef ), filterRef );
            };
        }
    }
    // Make a pager icon and append to a parent node.
    function makePagerIcon( parent, id, filterRef, opts ) {
        var icon = document.createElement('img');
        icon.src = 'images/'+id+'.png';
        icon.alt = icon.title = opts.pagingTitles[id];
        var $icon = $(parent).append( icon );
        $icon.addClass('nub-list-footer-'+id).click( pagerIconClickFns[id]( filterRef ) );
        return $icon;
    }

    // Make a list pager. Creates the different components of the pager - paging icons, page
    // number display etc. and passes them to the 'layoutPager' function defined in the options,
    // which should arrange the components in a suitable layout and then return the root element
    // of that layout.
    function makePager( list, opts ) {
        var $container = $('<div class="nub-list-footer">');
        var $form = $('<form>');
        var first = pagerIconClickFns.first( list.filterRef );
        var prev  = pagerIconClickFns.prev( list.filterRef );
        var next  = pagerIconClickFns.next( list.filterRef );
        var last  = pagerIconClickFns.last( list.filterRef );
        var $page = $('<span>')
            .append( $('<input>').attr('size','2')
                    .each( function() {
                        var $this = $(this);
                        $.nub.view('filter:args/page', function() {
                            $this.val( $.nub.get('filter:args/page', list.filterRef ) );
                        }, list.filterRef );
                    }).change(function() {
                        var page = Number( $(this).val() );
                        if( page != Number.NaN ) {
                            $.nub.set('filter:args/page', page, list.filterRef );
                        }
                        else {
                            $(this).val( $.nub.get('filter:args/page', list.filterRef ) );
                        }
                    }) )
            .append( document.createTextNode(' / ') );
        var $count = $('<span>');
        $.nub.view('lastPage', $count[0], list.filterRef );
        $page.append( $count );
        $form.append( opts.layoutPager( first, prev, $page, next, last ) );
        return list.elem.parentNode.insertBefore( $container.append( $form )[0], list.elem.nextSibling );
    }

    $.fn.nubList = function( opts ) {
        if( typeof( opts ) == 'string' ) { // => command
            switch( opts ) {
            case 'list':
                return $(this).first().data('nub-list');
            }
        }
        else {
            opts = $.extend( {}, {
                // Number of visible rows.
                rowCount: 20,
                // Whether to hide empty rows.
                hideEmptyRows: true,
                // CSS class used to mark empty rows.
                emptyRowCSS: 'nub-list-empty-row',
                // Whether to display a paging control.
                pager: true,
                // Make the pager layout.
                layoutPager: function( first, prev, $page, next, last ) {
                    return $('<ul>')
                        .append( $('<li>').append('<a>First</a>').click( first ) )
                        .append( $('<li>').append('<a>Previous</a>').click( prev ) )
                        .append( $('<li>').append( $page ) )
                        .append( $('<li>').append('<a>Next</a>').click( next ) )
                        .append( $('<li>').append('<a>Last</a>').click( last ) );
                },
                // Function called to allow initialization of list elements.
                oninit: function( listElement, pagerContainer ) {}
            }, opts );
            var lists = [];
            $(this).each(function() {
                // If available, read additional options from element metadata.
                if( $.metadata !== undefined ) {
                    opts = $.extend( {}, opts, $.metadata.get( this ) );
                }
                // Instantiate the list object.
                // Read the list's data reference.
                var dataRef = $(this).attr('data');
                var list = new List( this, dataRef, opts );
                // Setup views etc.
                if( opts.pager ) {
                    list.pager = makePager( list, opts );
                }
                opts.oninit( list.elem, list.pager );
                lists.push( list );
                $(this).data('nub-list', list );
            });
            return lists.length > 1 ? lists : lists[0];
        }
    };
})(jQuery);
