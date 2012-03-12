// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window*/

define(['MetaObject/MetaObject', 'opm/Connection'], 
function(           MetaObject,       connection) {

  // A subset of projects managed as a site under the Orchard rules

  var OrchardModel = MetaObject.extend({
  
    initialize: function(siteName, siteModel, projectsModel) {
      this.siteName = siteName;
      this.projectsModel = projectsModel;
      this.siteModel = siteModel;
    },
    
    getManagedProjects: function() {
      var names = this.siteModel.getManagedProjectNames();
      return names.map(function(name) {
        return this.projectsModel.projects[name];
      }.bind(this));
    },
    
    getUnmanagedProjects: function() {
      var names = this.siteModel.getManagedProjectNames();
      var projectsByName = this.projectsModel.projects;
      var unmanaged = [];
      Object.keys(projectsByName).forEach(function(name) {
        if (names.indexOf(name) === -1) { // not managed
          var project = projectsByName[name];
          unmanaged.push(project);
        }
      });
      return unmanaged;
    }
    
  });

  OrchardModel.isOrchardIdentifier = function(identifier) {
    return (identifier.indexOf('Orchard') !== -1);
  };
  
  OrchardModel.toOrchardIdentifier = function(identifier) {
    if (!OrchardModel.isOrchardIdentifier(identifier)) {
      identifier += 'Orchard';
    }
    return identifier;
  };

  return OrchardModel;

});
