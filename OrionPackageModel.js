// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console */

define(['orion/plugin.js','MetaObject/MetaObject'], 
function(        plugin,            MetaObject) {


  var OrionPackageModel = MetaObject.extend({
    initialize: function(jsonObj) {
      this.site = {};
      if (jsonObj) {
        jsonObj.SiteConfigurations.forEach(function(siteConfig) {
          if (siteConfig.Name === 'opm') {
            this.reconstitute(siteConfig);
          }
        });
      }
    },
    reconstitute: function(siteConfig) {
      Object.keys(siteConfig).forEach(function(key) {
        this.site[key] = siteConfig[key];
      });
    }
  });


  return OrionPackageModel;
});