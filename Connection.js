// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window*/

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
    function jsonToObject(isRetry, event) {
      try {
        var status = event.currentTarget.status;
        var response = event.currentTarget.response;
        var jsonObj = {};
        if (response) {
          jsonObj = JSON.parse(response);
          if (isRetry) {
            console.log("Retry "+status, jsonObj);
            if (jsonObj.Result) {
              if (status !== 200) {
                console.error("Retry gives Result but not 200 "+isRetry, event);
              } else {
                console.log("Retry gives 200 "+jsonObj.Id, event);
              }
              jsonObj = jsonObj.Result.JsonData;
              successCallback.apply(null, [jsonObj]);
              return;
            }
          }
        }
        if (isRetry || (status === 202 && jsonObj))  {
          if (jsonObj.Result) {
            console.error("Result but 202, "+isRetry, event);
          } 
          // http://wiki.eclipse.org/Orion/Server_API#Progress_reporting
          window.setTimeout(function() {
            console.log("retry "+jsonObj.Location, event);
            AJAX.GET(jsonObj.Location, jsonToObject.bind(null, true), errCallback); 
          }, 100);
        } else if (status === 200) {
          successCallback.apply(null, [jsonObj]);
        } else {
          errCallback.apply(null, [status, jsonObj]);
        }
      } catch(exc) {
        errCallback.apply(null, [exc]);
      }    
    }
    // AJAX callback
    args.push(jsonToObject.bind(null, false));
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