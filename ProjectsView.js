// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window */

define(['lib/domplate/lib/domplate','MetaObject/MetaObject','opm/Connection'], 
function(                 Domplate,             MetaObject,      connection) {


  function getAncestorByClassName(elt, className) {
    var parent = elt.parentNode;
    while(parent) {
      if (parent.classList.contains(className)) {
        return parent;
      }
      parent = parent.parentNode;
    }
  }


  var ProjectsView = MetaObject.extend({
    
    initialize: function(projectsModel, siteModel) {
      this.projectsModel = projectsModel;
      this.siteModel = siteModel;
    },
    
    getManagedProjects: function() {
      var names = this.siteModel.getManagedProjectLocations();
      return names.map(function(name) {
        return this.projectsModel.projects[name];
      }.bind(this));
    },
    
    getUnmanagedProjects: function() {
      var locations = this.siteModel.getManagedProjectLocations();
      var projectsByName = this.projectsModel.projects;
      var unmanaged = [];
      Object.keys(projectsByName).forEach(function(location) {
        if (locations.indexOf(location) === -1) { // not managed
          var project = projectsByName[location];
          unmanaged.push(project);
        }
      });
      return unmanaged;
    },
    
    render: function() {
      this._renderDomplate(this.getManagedProjects(), this.getUnmanagedProjects());
    },
    
    _renderDomplate: function(managed, unmanaged) {
      var body = window.document.body;
      templates.overview.tag.append({
        projects: managed,
      }, body);
      templates.addMore.tag.append({
        projects: unmanaged,
        siteModel: this.siteModel
      }, body);
    }
  });

  with (Domplate.tags) {

    var templates = {};
    
    templates.column = Domplate.domplate({
      
      getElementId: function(project) {
        return this.getColumnName() + '_' + project.Name;
      },
      getName: function(project) {
        return project.Name;
      },
      getCellContent: function(project) {
        this.update(project);
        return 'updating';
      },
      updateFailed: function(project, err) {
        console.error("Update "+this.getColumnName()+" on "+project.Name+" FAILED "+err, err);
        return err;
      },
      warn: 'gitWarn',
      err: 'gitError',
      ok:  'gitOk',
    });
    
    templates.status = Domplate.domplate(templates.column, {
      // This tag is the same in all templates derived from column, but domplate inheritance fails somehow
      tag: A({'id':'$project|getElementId', 'class':"columnLink columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
              "$project|getCellContent"
         ),
      getColumnName: function() {
        return 'status';
      },
      
      getColumnAction: function(project) {
        return  function(event) {
          var gitapi = project.StatusLocation.indexOf('/gitapi/');
          if (gitapi !== -1) {
            // eg http://localhost:8080/git/git-status.html#/gitapi/status/file/E/
            var statusURL = project.StatusLocation.substr(0, gitapi);
            statusURL += '/git/git-status.html#';
            statusURL += project.StatusLocation.substr(gitapi);
            window.open(statusURL);
          } else {
            console.error("Malformed StatusLocation for "+project.Name, project);
          }
        }
      },
      
      update: function(project) {
        connection.getObject(project.StatusLocation, this.renderUpdate.bind(this, project), this.updateFailed.bind(this, project));
      },
      
      symbolic: function(symbol, jsonObj, field) {
        var length = jsonObj[field].length;
        return (length ? symbol + length : ''); 
      },
      
      setCodeIf: function(status, code) {
        if(status) {
          this.code = code;
        }
        return status;
      },
      
      renderUpdate: function(project, jsonObj) {
        var status = "";
        status += this.setCodeIf(this.symbolic('+', jsonObj, 'Added'), this.warn);
        status += this.setCodeIf(this.symbolic('&Delta;', jsonObj, 'Modified'), this.warn);
        status += this.setCodeIf(this.symbolic('?', jsonObj, 'Changed'), this.err);
        status += this.setCodeIf(this.symbolic('X', jsonObj, 'Conflicting'), this.err);
        status += this.setCodeIf(this.symbolic('-', jsonObj, 'Missing'), this.err);
        if (!status) {
          status = "up to date";
          this.setCodeIf("up to date", this.ok);
        }
        var elt = document.getElementById(this.getElementId(project));
        elt.innerHTML = status;
        elt.setAttribute('gitStatus', this.code);
      },

    });
    
    templates.branches = Domplate.domplate({
      tag: DIV({'class':'overlay', 'onkeydown':"$project|getKeyDownAction"},
        DIV({'class':'input' },
          INPUT({'type':'checkbox', 'disabled':"disabled" }),
          INPUT({'class':'newBranchName', 'type':'text'})
        ),
        FOR("branch", "$branches", 
          INPUT({'type':'checkbox', 'checked':"$branch|getSelected" }),
          SPAN("$branch|getBranchName")
        )
      ),
      getBranchName: function(branch) {
        return branch.name;
      },
      getSelected: function(branch) {
        return (branch.selected ? 'checked' : 'false');
      },
      getKeyDownAction: function(event) {
        return function(event) {
          if (event.which === 13) {  // enter
            console.log('branch adding needed ', event);
          } else if (event.which === 27) {  // escape
            var overlay = getAncestorByClassName(event.target, 'overlay');
            overlay.parentElement.removeChild(overlay);
          }
        }
      }
    });
    
    templates.branch = Domplate.domplate(templates.column, {
      // This tag is the same in all templates derived from column, but domplate inheritance fails somehow
      tag: A({'id':'$project|getElementId', 'class':"columnLink  columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
              "$project|getCellContent"
         ),
      getColumnName: function() {
        return 'branch';
      },
      
      getColumnAction: function(project) {
        return  function(event) {
          var elt = document.getElementById(this.getElementId(project));
          var row = event.target.parentElement;
          var branches = elt.branches;
          if (branches) {
            var overlay = templates.branches.tag.insertAfter({project: project, branches: branches}, row);
            overlay.style.left = elt.offsetLeft + 'px';
            overlay.style.top = (elt.offsetTop + elt.offsetHeight) +'px';
            overlay.getElementsByClassName('newBranchName')[0].focus();
          }
        }
      },
      
      update: function(project) {
        connection.getObject(project.BranchLocation, this.renderUpdate.bind(this, project), this.updateFailed.bind(this, project));
      },
      
      renderUpdate: function(project, jsonObj) {
        var elt = document.getElementById(this.getElementId(project));
        var branches = [];
        jsonObj.Children.forEach(function(child) {
          if (child.Current) {
            elt.innerHTML = child.Name;
          }
          var remotes = child.RemoteLocation.map(function(remote){
            var trackingBranch = remote.Children.map(function(remoteBranch) {
              return (remoteBranch.Type === "RemoteTrackingBranch") ? remoteBranch.Name : "";
            });
            return {name: trackingBranch.join(" "), gitURL: remote.GitUrl};
          });
          branches.push({name: child.Name, selected: child.Current, remotes: remotes});
        });
        elt.branches = branches;
      },

    });

    templates.push = Domplate.domplate(templates.column, {
      tag: DIV({'id':'$project|getElementId', 'title':'$project|getTitle', 'class':"columnButton columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
             '&#x21a6;'
         ),
      getTitle: function(project) {
        return "Push "+project.Name+" to remote";
      },
      getColumnName: function() {
        return 'push';
      },
      getColumnAction: function(project) {
        return function(event) {
          alert("TODO");
        }
      },

    });

    templates.pull = Domplate.domplate(templates.column, {
      // This tag is the same in all templates derived from column, but domplate inheritance fails somehow
      tag: DIV({'id':'$project|getElementId', 'title':'$project|getTitle', 'class':"columnButton columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
             '&#x21a4;'
         ),
      getTitle: function(project) {
        return "Pull "+project.Name+" from remote";
      },
      getColumnName: function() {
        return 'pull';
      },
      getColumnAction: function(project) {
        return function(event) {
          alert("TODO");
        }
      },

    });

    templates.remote = Domplate.domplate(templates.column, {
      // This tag is the same in all templates derived from column, but domplate inheritance fails somehow
      tag: A({'id':'$project|getElementId', 'class':"columnLink $project|getColumnName", 'onclick':"$project|getColumnAction"},
              "$project|getCellContent"
         ),
      getColumnName: function() {
        return 'remote';
      },
      
      getColumnAction: function(project) {
        return  function(event) {
          alert("pop up a list of remotes?");
        }
      },
      
      update: function(project) {
        connection.getObject(project.BranchLocation, this.renderUpdate.bind(this, project), this.updateFailed.bind(this, project));
      },
      
      renderUpdate: function(project, jsonObj) {
        var elt = document.getElementById(this.getElementId(project));
        var branches = [];
        jsonObj.Children.forEach(function(child) {
          
          child.RemoteLocation.some(function(remote){
            return remote.Children.some(function(remoteBranch) {
              if (remoteBranch.Type === "RemoteTrackingBranch") {
                elt.innerHTML = remoteBranch.Name;
                return true;
              }
            });
          });
        });
      },

    });
    
    templates.unmanage = Domplate.domplate(templates.column, {
      tag: SPAN({'id':'$project|getElementId',  'title':'$project|getTitle','class':'unmanage columnButton columnCell', 'onclick':"$project|getColumnAction" },'&#x25BC;'),
            getColumnName: function() {
        return 'unmanage';
      },

      getTitle: function(project) {
        return "Remove "+project.Name+" from the projects managed list";
      },
      
      getColumnAction: function(project) {
        return function(event) {
          var unmanagedProjectElement = window.document.querySelector(".unmanaged");
          var siteModel = unmanagedProjectElement.siteModel;
          var row = event.target.parentElement;
          siteModel.removeProject(project).then(
            function() {
              row.classList.add('hidden');
              },
            function() {
              console.error("unmanage fails ", arguments);
            }
          ).end();
        }
      }
    });

    templates.project = Domplate.domplate({
      tag: DIV({'class': 'opmProject managedProject'},
             SPAN({_project: '$project', 'class':'projectName'}, "$project|getName"),
             TAG(templates.branch.tag, {project: "$project"}),
             TAG(templates.status.tag, {project: "$project"}),
             TAG(templates.pull.tag, {project: "$project"}),
             TAG(templates.push.tag, {project: "$project"}),
             TAG(templates.remote.tag, {project: "$project"}),
             TAG(templates.unmanage.tag, {project: "$project"})
           ),
      getName: function(project) {
        return project.Name;
      },

    });

    templates.projects = Domplate.domplate({
          tag: DIV({'id':'opProjects'},
            H2("Managed Projects"),
            DIV({'class':'opmProjectHeader'}, 
               SPAN('Project'),
               SPAN('Branch'),
               SPAN('git Status'),
               SPAN('Pull'),
               SPAN('Push'),
               SPAN('Remote'),
               SPAN('')
            ),               
            FOR('project', '$projects',
              TAG(templates.project.tag, {project: '$project'})
            ),
            DIV({'class':'opmProjectFooter'},
              SPAN('Update All'),
              SPAN({'id': 'gitBranchUpdateAll'}),
              SPAN({'id': 'gitStatusUpdateAll'}),
              SPAN({'id': 'gitPullUpdateAll'}),
              SPAN({'id': 'gitPushUpdateAll'}),
              SPAN({'id': 'gitRemoteUpdateAll'})
            )
          ),
        });
        
    templates.overview = Domplate.domplate({
          tag: DIV({'id':'opView'},
            H1("Git Project Manager"),
            TAG(templates.projects.tag, {projects: "$projects"})
          ),
        });
        
    // http://stackoverflow.com/questions/2701192/html-is-there-an-ascii-character-for-a-up-down-triangle-arrow
    templates.addMore = Domplate.domplate({
      tag: DIV({'id': 'addMore','onkeydown': '$installIfEnter'},
           H2("Manage More Projects"),
           FOR('project', '$projects', 
              DIV({'class': 'opmProject unmanaged', _siteModel: '$siteModel'},
                SPAN({'class':'arrow-box', 'onclick': '$addProject', 'title': "$project|getTooltip"},
                  SPAN({'class':'unicode-arrow-up'}, '&#x25B2;')
                ),
                SPAN({'class': 'projectName', _repObject: '$project'}, "$project|getName")
              )
            )
          ),
      getName: function(project) {
        return project.Name;
      },
      getTooltip: function(project) {
        return "Add project\'"+project.Name + "\' to managed projects";
      },
      addProject: function(event) {
        var projectElement = event.target.parentElement.nextElementSibling;
        var projectName = projectElement.innerText;
        console.log("adding "+projectName);
        var project = projectElement.repObject;
        var siteElement = projectElement.parentElement;
        var siteModel = siteElement.siteModel;
        siteModel.addProject(project).then(
          function afterAddProject(event) {
            siteElement.classList.add('hidden');
            var footer = document.querySelector('.opmProjectFooter');
            templates.project.tag.insertAfter({project: project}, footer.previousElementSibling);
          },
          function errorAddProject(event) {
            console.error(event);
          }
        );
      },
      installIfEnter: function(event) {
        if (event.which === 13) {
          this.installProject(event);
        }
      },
    });
  }


  return ProjectsView;
});