// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console */

define(['MetaObject/MetaObject', 'opm/Connection'], 
function(           MetaObject,       connection) {

  var ourSpecialSiteName = "opm";

  var SiteModel = MetaObject.extend({
  
    initialize: function(connection, jsonObj) {
      this.connection = connection;
      this.site = {};
      if (jsonObj) {
        jsonObj.SiteConfigurations.forEach(function(siteConfig) {
          if (siteConfig.Name === ourSpecialSiteName) {
            this.site = siteConfig;
          }
        }.bind(this));
      }
    },
  
    getManagedProjectNames: function() {
      var mappings = this.site.Mappings;
      var names = mappings.map(function(mapping) {
        var name = mapping.Target.substr(1);  // /name -> name
        return name;
      });
      return names;
    },
    
    addProject: function(gitRepoProject) {
      var name = gitRepoProject.Name;
      var source = '/'+ name;    // eg 'q' -> /q
      var target = source;       // the project name is magical in Orion
      this.site.Mappings.push({Source: source, Target: target, FriendlyPath: name});
      return this.updateOrion();
    },

    removeProject: function(gitRepoProject) {
      var name = gitRepoProject.Name;
      var source = '/'+ name;    // eg 'q' -> /q
      var target = source;
      this.site.Mappings.some(function(mapping, index) {
        if (target === mapping.Target) {
          this.site.Mappings.splice(index, 1);
          return true;
        }
      }.bind(this));
      return this.updateOrion();
    },
    
    updateOrion: function() {
      return this.connection.put('/site/'+this.site.Id, this.site);
    }
    
  });
  

  return SiteModel;
});