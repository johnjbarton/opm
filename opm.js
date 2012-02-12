// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console */

define(['MetaObject/AJAX','ProjectsModel', 'ProjectsView', 'q/q'], 
function(           AJAX,  ProjectsModel,   ProjectsView,     Q) {


  var opm = {
    onError: function(action) {
      return function(err) {
        console.error("Orion Package Manager ERROR during "+action+": "+err, err);
      }.bind(this);
    },
    
    onWorkspaces: function(obj) {
      console.log("onWorkspaces", obj);
      // only support one workspace
      var workspace = obj.Workspaces[0];
      // The workspace itself only lists 'projects', they don't seem interesting. 
      var gitRootURL = "/gitapi/clone/workspace/"+workspace.Id;
      return AJAX.promiseGET(gitRootURL).then(
        opm.on('gitRepos'), 
        opm.onError('git repositories in workspace '+workspace.Id)
      );
    },
    
    ongitRepos: function(obj) {
      console.log("ongitRepos", obj);
      // NO, this needs to build ReprosModel for the Add button and to fill in the Projects table cells
      // ProjectModel needs to be built from 'opm' site entries as keys into the ReprosModel data
      this.projectsModel = ProjectsModel.new(obj);
    },
    
    onSites: function(obj) {
      console.log("onSites ", obj);
      // need to return promise
    },
    
    render: function() {
      console.log("render");
         var opView = ProjectsView.new(this.projectsModel);
         opView.render();
    },
    
    on: function(kind) {
      var method = this['on'+kind];
      return function(event) {
        var obj = JSON.parse(event.currentTarget.response);
        return method.apply(this, [obj, event]);
      }.bind(this);
    },
    
    buildPage: function() {
      // If you accidently omit the [], you get an obscure error message
      var all = Q.all([
        AJAX.promiseGET('/workspace').then(
          opm.on('Workspaces'), 
          opm.onError('workspace list')
        ),
        AJAX.promiseGET('/site').then(
          opm.on('Sites'), 
          opm.onError('site list')
        )
      ]);
      
      console.log("all done", all);
      Q.when(all, function(all) {
          opm.render();
       }).end();
    },
  };
  
  
  return opm;
});