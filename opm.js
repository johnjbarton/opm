// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console */

define(['MetaObject/AJAX','OrionPackageModel', 'OrionPackageView'], 
function(           AJAX,  OrionPackageModel,   OrionPackageView) {


  var opm = {
    onError: function(action, err) {
      console.error("Orion Package Manager ERROR during "+action+": "+err, err);
    },
    onSite: function(event) {
      var responseObj = JSON.parse(event.currentTarget.response);
      console.log("onSite ", responseObj);
      var opModel = OrionPackageModel.new(responseObj);
      var opView = OrionPackageView.new(opModel);
      opView.render();
      debugger;
    },
    buildPage: function() {
      AJAX.GET('/site', opm.onSite, opm.onError.bind(opm, 'site list'));
    }
  };
  
  
  return opm;
});