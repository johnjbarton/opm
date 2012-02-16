// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console */

define(['MetaObject/AJAX', 'opm/Connection', 'ProjectsView', 'q/q'], 
function(           AJAX ,      connection,   ProjectsView,     Q) {


  var opm = {
    
    render: function(connection) {
      console.log("render");
         var opView = ProjectsView.new(connection.projectsModel, connection.siteModel);
         opView.render();
    },
    
    buildPage: function() {
      connection.load(function(conection) {
         opm.render(connection);
      });
    },
  };
  
  
  return opm;
});