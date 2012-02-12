// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console */

define(['MetaObject/MetaObject'], 
function(MetaObject) {


  var ProjectsModel = MetaObject.extend({
    initialize: function(jsonObj) {
      this.projects = [];
      if (jsonObj) {
        jsonObj.Children.forEach(function(project) {
            this.projects.push(project);
        }.bind(this));
      }
    }
  });


  return ProjectsModel;
});