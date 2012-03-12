// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console */

define(['MetaObject/AJAX','ProjectsModel', 'SiteModel', 'q/q'], 
function(           AJAX,  ProjectsModel,   SiteModel,     Q) {

function ajax(verb) {  
  // close over verb, eg GET
  return function() {
    var args = Array.prototype.slice.call(arguments);
    var errCallback = args.pop();
    var successCallback = args.pop();
    if (args.length === 2) {
      var obj = args.pop();
      var json = JSON.stringify(obj);
      args.push(json);
    }
    args.push(function jsonToObject(event) {
      try {
        var status = event.currentTarget.status;
        var response = event.currentTarget.response;
        var jsonObj = {};
        if (response) {
          jsonObj = JSON.parse(response);
        }
        if (status >= 200 && status < 300) {
          successCallback.apply(null, [jsonObj]);
        } else {
          errCallback.apply(null, [status, jsonObj]);
        }
      } catch(exc) {
        errCallback.apply(null, [exc]);
      }    
    });
    args.push(errCallback);
    return AJAX[verb].apply(null, args); 
  };
}

var Connection = {
  siteModels: {},

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
  
  getObject: ajax('GET'),  // URL
  putObject: ajax('PUT'),  // URL, body
  postObject: ajax('POST'),// URL, body
  
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

  onworkspace: function(obj) {
    console.log("onWorkspaces", obj);
    // only support one workspace
    this.workspace = obj.Workspaces[0];
    var id = this.workspace.Id;
    // The workspace itself only lists 'projects', they don't seem interesting. 
    var gitRootURL = '/gitapi/clone/workspace/' + id;
    return this.get(gitRootURL, 'gitRepos', 'git repositories in workspace ' + id);
  },
      
  ongitRepos: function(obj) {
    console.log("ongitRepos", obj);
    this.projectsModel = ProjectsModel.new(this, obj);
  },
    
  onsite: function(jsonObj) {
    console.log("onSites ", jsonObj);
    if (jsonObj) {
      jsonObj.SiteConfigurations.forEach(function(siteConfig) {
        var siteName = siteConfig.Name;
        this.siteModels[siteName] = SiteModel.new(this, siteConfig);
      }.bind(this));
    }
  },
  
  getSiteNames: function() {
    return Object.keys(this.siteModels);
  },
  
  load: function(fncOfConnection) {
     return Q.all([
       this.get('workspace'),
       this.get('site')
     ]).then(
       fncOfConnection
     );
  },

  put: function(path, obj) {
    var json = JSON.stringify(obj);
    return AJAX.promisePUT(path, json);
  }

};

return Connection;

});