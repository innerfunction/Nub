About this project
==================

This project contains version 2.0 of Nub. You can see the full doc at: http://innerfunction.com/jquery.nub/current/docs/nub-intro.html


Previous versions can be found at (https://github.com/juliangoacher/jquery.nub)


Project description
===================

Nub is a plugin for jQuery which adds MVC (Model-View-Controller) functionality to a page.
Nub allows HTML elements on a page to act as views on a data model which will be refreshed everytime the model is updated.
Nub provides many additional capabilities built on the basic MVC functionality, these include:

* Functions for reading and writing data to and from a remote server using JSON + AJAX.
* A list framework for displaying paged lists of data.
* The ability to register callback functions as model views.

Nub in 30 seconds
=================

Include jQuery and the Nub plugin on your page:

    <script src="jquery.js"></script>
    <script src="jquery.nub.js"></script>

Mark view elements on your page with the 'nub-view' CSS class and a data attribute referencing the data:

    <span class="nub-view" data="/user/firstname"></span>
    <span class="nub-view" data="/user/lastname"></span>

Initialize the page views when the page has loaded:

    $(document).ready(function() { $.nub.init(); });

Write data to the model and watch the page update!

    $.nub.set('/user', { firstname:'Titus', lastname:'Oates' });

Documentation
=============

The [Nub intro](http://innerfunction.com/nub/nub-intro.html) document gives a good overview of all Nub's functions and capabilities.
The [Nub API](http://innerfunction.com/nub/nub-api.html) document gives more detail information on the functions and objects available in Nub.

Project contents
================

The project contains the following:

    src/            Nub source files.
    docs/           Nub documentation.
    dist/           Latest and minified versions of the Nub plugin.
    libs/           Additional libraries required to run Nub.
    test/           Unit tests.
    build/          Scripts for building the distribution files.
    GPL-LICENSE.txt GNU General Public Licence text.
    MIT-LICENSE.txt MIT Licence text.
    README.md       This file.

Licence
=======

Nub is released under a dual GPL / MIT licence.

