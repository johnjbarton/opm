// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console */

define(['lib/domplate/lib/domplate','MetaObject/MetaObject'], 
function(    Domplate,            MetaObject) {

  var OrionPackageView = MetaObject.extend({
    
    initialize: function(opModel) {
      this.opModel = opModel;
    },
    
    render: function() {
      this._buildDomplate();
      this._renderDomplate(this.opModel);
    },
    
    _buildDomplate: function() {
      with (Domplate.tags) {
        this.packageTemplate =
          DIV({'id':'opView'},
            FOR('package', '$packages', 
              DIV({'class': 'opmPackage'},
                SPAN({object: '$package'})
              )
            ),
            INPUT({'id': 'newPackageName', 'value': ''})
          );
      }
    },
    
    _renderDomplate: function(opModel) {
      var body = document.getElementsByTagName('body')[0];
      this.packageTemplate.tag.replace({
        object: opModel
      }, body);
    },
  });


  return OrionPackageView;
});