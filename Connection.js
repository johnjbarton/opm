// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console */

define(['MetaObject/AJAX','ProjectsModel', 'SiteModel', 'q/q'], 
function(           AJAX,  ProjectsModel,   SiteModel,     Q) {

var Connection = {

  on: function(kind) {
    var method = this['on'+kind];
    if (!method) {
      console.error("no method "+kind);
    }
    return function(event) {
      var obj = JSON.parse(event.currentTarget.response);
      return method.apply(this, [obj, event]);
    }.bind(this);
  },
  
  onError: function(action) {
    return function(event) {
      console.error("Orion Package Manager ERROR during "+action+": "+event.target.url, event);
    }.bind(this);
  },
  
  getObject: function(path, fnOfObject, fnOfErr) {
    AJAX.GET(path, function(event) {
      try {
        var jsonObj = JSON.parse(event.currentTarget.response);
        fnOfObject(jsonObj);
      } catch(exc) {
        fnOfErr(exc);
      }
    }, fnOfErr);
  },
  
  get: function(path, method, errMessage) {
    method = method || path;
    errMessage = errMessage || path;
    if (path[0] !== '/') {
      path = '/' + path;
    }
    return AJAX.promiseGET(path).then(
        this.on(method), 
        this.onError(errMessage)
      );
  },
    
  load: function(fncOfConnection) {
     return Q.all([
       this.get('workspace'),
       this.get('site')
     ]).then(
       fncOfConnection
     );
  },
    
  onworkspace: function(obj) {
    console.log("onWorkspaces", obj);
    // only support one workspace
    var workspace = obj.Workspaces[0];
    // The workspace itself only lists 'projects', they don't seem interesting. 
    var gitRootURL = "/gitapi/clone/workspace/"+workspace.Id;
    return this.get(gitRootURL, 'gitRepos', 'git repositories in workspace '+workspace.Id);
  },
      
  ongitRepos: function(obj) {
    console.log("ongitRepos", obj);
    this.projectsModel = ProjectsModel.new(this, obj);
  },
    
  onsite: function(obj) {
    console.log("onSites ", obj);
    this.siteModel = SiteModel.new(this, obj);
    // need to return promise
  },
  
  put: function(path, obj) {
    var json = JSON.stringify(obj);
    return AJAX.promisePUT(path, json);
  }

};

return Connection;

});